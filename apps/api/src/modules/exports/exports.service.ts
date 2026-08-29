import { HttpStatus, Injectable, StreamableFile } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { createReadStream, promises as fs } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { DomainError } from '../../common/errors/domain-error';
import type { RequestUser } from '../../common/guards/auth.guard';
import { PrismaService } from '../../database/prisma.service';
import { ScopeService } from '../rbac/scope.service';

@Injectable()
export class ExportsService {
  private readonly root = resolve(process.env.UPLOAD_DIR ?? './uploads', 'exports');

  constructor(private readonly prisma: PrismaService, private readonly scope: ScopeService) {}

  async list(user: RequestUser) {
    const jobs = await this.prisma.exportJob.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    return jobs.map((job) => ({
      id: job.id,
      type: this.typeLabel(job.type),
      status: job.expiresAt && job.expiresAt < new Date() && job.status === 'COMPLETED' ? 'EXPIRED' : job.status,
      rowCount: job.rowCount,
      createdAt: job.createdAt.toISOString(),
      downloadUrl: job.status === 'COMPLETED' && (!job.expiresAt || job.expiresAt > new Date())
        ? `/api/v1/exports/${job.id}/download`
        : null,
    }));
  }

  async createExcel(user: RequestUser, type: 'students' | 'attendance' | 'grades' | 'centers') {
    await fs.mkdir(this.root, { recursive: true });
    const job = await this.prisma.exportJob.create({
      data: {
        organizationId: user.organizationId,
        type,
        status: 'PROCESSING',
        createdById: user.id,
        expiresAt: new Date(Date.now() + 7 * 86_400_000),
      },
    });
    const filePath = join(this.root, `${job.id}-${type}.xlsx`);

    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Student Management System';
      workbook.created = new Date();
      let rowCount = 0;
      if (type === 'students') rowCount = await this.addStudentsSheet(workbook, user);
      if (type === 'attendance') rowCount = await this.addAttendanceSheet(workbook, user);
      if (type === 'grades') rowCount = await this.addGradesSheet(workbook, user);
      if (type === 'centers') rowCount = await this.addCentersSheets(workbook, user);
      await workbook.xlsx.writeFile(filePath);
      await this.completeJob(job.id, filePath, rowCount, user);
      return { id: job.id, status: 'COMPLETED' };
    } catch (error) {
      await this.prisma.exportJob.update({ where: { id: job.id }, data: { status: 'FAILED' } });
      throw error;
    }
  }

  async createFullSnapshot(user: RequestUser) {
    await fs.mkdir(this.root, { recursive: true });
    const job = await this.prisma.exportJob.create({
      data: {
        organizationId: user.organizationId,
        type: 'full-snapshot',
        status: 'PROCESSING',
        createdById: user.id,
        expiresAt: new Date(Date.now() + 3 * 86_400_000),
      },
    });
    const filePath = join(this.root, `${job.id}-full-snapshot.xlsx`);

    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Student Management System';
      workbook.created = new Date();
      const counts: Record<string, number> = {};
      counts.students = await this.addStudentsSheet(workbook, user);
      counts.attendance = await this.addAttendanceSheet(workbook, user);
      counts.grades = await this.addGradesSheet(workbook, user);
      counts.centersAndEnrollments = await this.addCentersSheets(workbook, user);
      this.addSummarySheet(workbook, counts);
      await workbook.xlsx.writeFile(filePath);
      await this.completeJob(job.id, filePath, Object.values(counts).reduce((sum, value) => sum + value, 0), user);
      return { id: job.id, status: 'COMPLETED' };
    } catch (error) {
      await this.prisma.exportJob.update({ where: { id: job.id }, data: { status: 'FAILED' } });
      throw error;
    }
  }

  async download(user: RequestUser, jobId: string): Promise<{ stream: StreamableFile; fileName: string; contentType: string }> {
    const job = await this.prisma.exportJob.findFirst({
      where: { id: jobId, organizationId: user.organizationId, status: 'COMPLETED' },
    });
    if (!job?.filePath) throw new DomainError('RESOURCE_NOT_FOUND', 'ملف التصدير غير موجود.', HttpStatus.NOT_FOUND);
    if (job.expiresAt && job.expiresAt < new Date()) throw new DomainError('EXPORT_EXPIRED', 'انتهت صلاحية ملف التصدير.', HttpStatus.GONE);
    const filePath = resolve(job.filePath);
    if (filePath !== this.root && !filePath.startsWith(`${this.root}\\`) && !filePath.startsWith(`${this.root}/`)) {
      throw new DomainError('RESOURCE_NOT_FOUND', 'مسار الملف غير صالح.', HttpStatus.NOT_FOUND);
    }
    await fs.access(filePath);
    return {
      stream: new StreamableFile(createReadStream(filePath)),
      fileName: basename(filePath),
      contentType: filePath.endsWith('.xlsx')
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'application/octet-stream',
    };
  }

  private async addStudentsSheet(workbook: ExcelJS.Workbook, user: RequestUser): Promise<number> {
    const enrollmentScope = user.isSuperAdmin
      ? { status: 'ACTIVE' as const }
      : { status: 'ACTIVE' as const, centerId: { in: user.centerScopeIds } };
    const students = await this.prisma.student.findMany({
      where: {
        organizationId: user.organizationId,
        archivedAt: null,
        profiles: { some: { enrollments: { some: enrollmentScope } } },
      },
      include: {
        profiles: {
          where: { enrollments: { some: enrollmentScope } },
          take: 1,
          orderBy: { createdAt: 'desc' },
          include: { enrollments: { where: enrollmentScope, take: 1, include: { center: true } } },
        },
        guardians: { where: { isPrimary: true }, take: 1, include: { guardian: true } },
      },
      orderBy: { fullName: 'asc' },
    });
    const sheet = workbook.addWorksheet('الطلاب');
    sheet.views = [{ state: 'frozen', ySplit: 1, rightToLeft: true }];
    sheet.columns = [
      { header: 'كود الطالب', key: 'code', width: 18 },
      { header: 'اسم الطالب', key: 'name', width: 30 },
      { header: 'الصف', key: 'grade', width: 18 },
      { header: 'السنتر', key: 'center', width: 22 },
      { header: 'ولي الأمر', key: 'guardian', width: 28 },
      { header: 'الهاتف', key: 'phone', width: 18 },
      { header: 'الحالة', key: 'status', width: 14 },
    ];
    students.forEach((student) => {
      const profile = student.profiles[0];
      const enrollment = profile?.enrollments[0];
      const guardian = student.guardians[0]?.guardian;
      sheet.addRow({ code: profile?.studentCode, name: this.safeCell(student.fullName), grade: profile?.gradeLevel, center: enrollment?.center.name, guardian: guardian?.fullName, phone: guardian?.phoneE164, status: student.status });
    });
    this.styleSheet(sheet);
    return students.length;
  }

  private async addAttendanceSheet(workbook: ExcelJS.Workbook, user: RequestUser): Promise<number> {
    const rows = await this.prisma.attendanceRecord.findMany({
      where: {
        organizationId: user.organizationId,
        enrollment: { center: this.scope.centerWhere(user) },
        lesson: {
          OR: [
            { center: this.scope.centerWhere(user) },
            { scopes: { some: { center: this.scope.centerWhere(user) } } },
          ],
        },
      },
      include: { student: true, enrollment: { include: { center: true } }, lesson: { include: { center: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50_000,
    });
    const sheet = workbook.addWorksheet('الحضور');
    sheet.views = [{ state: 'frozen', ySplit: 1, rightToLeft: true }];
    sheet.columns = [
      { header: 'الطالب', key: 'student', width: 30 },
      { header: 'السنتر', key: 'center', width: 22 },
      { header: 'الحصة', key: 'lesson', width: 24 },
      { header: 'الحالة', key: 'status', width: 14 },
      { header: 'وقت التسجيل', key: 'time', width: 24 },
      { header: 'الطريقة', key: 'method', width: 14 },
    ];
    rows.forEach((row) => sheet.addRow({ student: this.safeCell(row.student.fullName), center: row.lesson.center?.name ?? row.enrollment.center.name, lesson: row.lesson.title ?? 'حصة', status: row.status, time: row.checkInAt?.toISOString() ?? '', method: row.method }));
    this.styleSheet(sheet);
    return rows.length;
  }

  private async addGradesSheet(workbook: ExcelJS.Workbook, user: RequestUser): Promise<number> {
    const rows = await this.prisma.grade.findMany({
      where: {
        organizationId: user.organizationId,
        enrollment: { center: this.scope.centerWhere(user) },
        exam: { assignments: { some: { center: this.scope.centerWhere(user) } } },
      },
      include: { student: true, exam: true, enrollment: { include: { center: true } } },
      orderBy: { updatedAt: 'desc' },
      take: 50_000,
    });
    const sheet = workbook.addWorksheet('الدرجات');
    sheet.views = [{ state: 'frozen', ySplit: 1, rightToLeft: true }];
    sheet.columns = [
      { header: 'الطالب', key: 'student', width: 30 },
      { header: 'الامتحان', key: 'exam', width: 26 },
      { header: 'السنتر', key: 'center', width: 20 },
      { header: 'الدرجة', key: 'score', width: 12 },
      { header: 'الدرجة النهائية', key: 'max', width: 16 },
      { header: 'النسبة', key: 'percentage', width: 12 },
      { header: 'الحالة', key: 'status', width: 14 },
    ];
    rows.forEach((row) => sheet.addRow({ student: this.safeCell(row.student.fullName), exam: this.safeCell(row.exam.name), center: row.enrollment.center.name, score: row.score ? Number(row.score) : null, max: Number(row.exam.maxScore), percentage: row.percentage ? Number(row.percentage) : null, status: row.status }));
    this.styleSheet(sheet);
    return rows.length;
  }

  private async addCentersSheets(workbook: ExcelJS.Workbook, user: RequestUser): Promise<number> {
    const centers = await this.prisma.center.findMany({
      where: { ...this.scope.centerWhere(user), archivedAt: null },
      include: {
        enrollments: {
          where: { status: 'ACTIVE' },
          include: {
            academicYear: true,
            profile: {
              include: {
                student: {
                  include: {
                    guardians: { where: { isPrimary: true }, take: 1, include: { guardian: true } },
                  },
                },
              },
            },
          },
          orderBy: { profile: { student: { fullName: 'asc' } } },
        },
      },
      orderBy: { name: 'asc' },
    });

    const centersSheet = workbook.addWorksheet('السناتر');
    centersSheet.views = [{ state: 'frozen', ySplit: 1, rightToLeft: true }];
    centersSheet.columns = [
      { header: 'كود السنتر', key: 'code', width: 16 },
      { header: 'اسم السنتر', key: 'name', width: 28 },
      { header: 'العنوان', key: 'address', width: 34 },
      { header: 'مسؤول السنتر', key: 'manager', width: 24 },
      { header: 'رقم التواصل', key: 'phone', width: 20 },
      { header: 'الحالة', key: 'status', width: 14 },
      { header: 'عدد الطلاب الحالي', key: 'studentsCount', width: 20 },
    ];
    centers.forEach((center) => centersSheet.addRow({
      code: center.code,
      name: this.safeCell(center.name),
      address: center.address,
      manager: center.managerName,
      phone: center.contactPhoneE164,
      status: center.status,
      studentsCount: center.enrollments.length,
    }));
    this.styleSheet(centersSheet);

    const studentsSheet = workbook.addWorksheet('طلاب السناتر');
    studentsSheet.views = [{ state: 'frozen', ySplit: 1, rightToLeft: true }];
    studentsSheet.columns = [
      { header: 'كود السنتر', key: 'centerCode', width: 16 },
      { header: 'اسم السنتر', key: 'centerName', width: 26 },
      { header: 'كود الطالب', key: 'studentCode', width: 18 },
      { header: 'اسم الطالب', key: 'studentName', width: 30 },
      { header: 'الصف', key: 'gradeLevel', width: 18 },
      { header: 'العام الدراسي', key: 'academicYear', width: 18 },
      { header: 'هاتف الطالب', key: 'studentPhone', width: 18 },
      { header: 'ولي الأمر', key: 'guardianName', width: 28 },
      { header: 'هاتف ولي الأمر', key: 'guardianPhone', width: 20 },
      { header: 'تاريخ الالتحاق', key: 'startDate', width: 18 },
      { header: 'الحالة', key: 'status', width: 14 },
    ];
    let enrollmentsCount = 0;
    centers.forEach((center) => center.enrollments.forEach((enrollment) => {
      const student = enrollment.profile.student;
      const guardian = student.guardians[0]?.guardian;
      studentsSheet.addRow({
        centerCode: center.code,
        centerName: this.safeCell(center.name),
        studentCode: enrollment.profile.studentCode,
        studentName: this.safeCell(student.fullName),
        gradeLevel: enrollment.profile.gradeLevel,
        academicYear: enrollment.academicYear.name,
        studentPhone: student.studentPhoneE164,
        guardianName: guardian ? this.safeCell(guardian.fullName) : '',
        guardianPhone: guardian?.phoneE164,
        startDate: enrollment.startDate,
        status: student.status,
      });
      enrollmentsCount += 1;
    }));
    studentsSheet.getColumn('startDate').numFmt = 'yyyy-mm-dd';
    this.styleSheet(studentsSheet);
    return centers.length + enrollmentsCount;
  }

  private addSummarySheet(workbook: ExcelJS.Workbook, counts: Record<string, number>): void {
    const sheet = workbook.addWorksheet('ملخص', { properties: { tabColor: { argb: 'FF2F78F4' } } });
    sheet.views = [{ state: 'frozen', ySplit: 1, rightToLeft: true }];
    sheet.columns = [
      { header: 'البيان', key: 'label', width: 32 },
      { header: 'عدد الصفوف', key: 'count', width: 18 },
    ];
    sheet.addRows([
      { label: 'الطلاب', count: counts.students },
      { label: 'سجلات الحضور', count: counts.attendance },
      { label: 'سجلات الدرجات', count: counts.grades },
      { label: 'السناتر وطلابها', count: counts.centersAndEnrollments },
      { label: 'تاريخ إنشاء النسخة', count: new Date().toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' }) },
    ]);
    this.styleSheet(sheet);
  }

  private styleSheet(sheet: ExcelJS.Worksheet): void {
    sheet.autoFilter = { from: 'A1', to: `${sheet.getColumn(sheet.columnCount).letter}1` };
    const header = sheet.getRow(1);
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2F78F4' } };
    header.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.eachRow((row, index) => {
      row.height = index === 1 ? 28 : 24;
      row.alignment = { vertical: 'middle' };
    });
  }

  private safeCell(value: string): string {
    return /^[=+\-@]/.test(value) ? `'${value}` : value;
  }

  private async completeJob(jobId: string, filePath: string, rowCount: number, user: RequestUser): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.exportJob.update({ where: { id: jobId }, data: { status: 'COMPLETED', filePath, rowCount } }),
      this.prisma.auditLog.create({ data: { organizationId: user.organizationId, actorUserId: user.id, action: 'EXPORT_CREATED', entityType: 'ExportJob', entityId: jobId, metadataJson: { rowCount } } }),
    ]);
  }

  private typeLabel(type: string): string {
    return ({ students: 'تقرير الطلاب', attendance: 'تقرير الحضور', grades: 'تقرير الدرجات', centers: 'تقرير السناتر وطلابها', 'full-snapshot': 'نسخة Excel شاملة' } as Record<string, string>)[type] ?? type;
  }
}
