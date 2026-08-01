import { HttpStatus, Injectable, StreamableFile } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { promises as fs } from 'node:fs';
import { join, resolve } from 'node:path';
import { DomainError } from '../../common/errors/domain-error';
import type { RequestUser } from '../../common/guards/auth.guard';
import { PrismaService } from '../../database/prisma.service';
import { StudentsService } from '../students/students.service';

type ParsedRow = {
  rowNumber: number;
  fullName: string;
  gradeLevel: string;
  studentPhone?: string;
  schoolName?: string;
  guardianName: string;
  guardianPhone: string;
  centerCode: string;
  notes?: string;
  centerId?: string;
  errors: string[];
};

@Injectable()
export class ImportsService {
  private readonly root = resolve(process.env.UPLOAD_DIR ?? './uploads', 'imports');

  constructor(
    private readonly prisma: PrismaService,
    private readonly students: StudentsService,
  ) {}

  async template(): Promise<{ stream: StreamableFile; fileName: string }> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Students', { views: [{ state: 'frozen', ySplit: 1, rightToLeft: true }] });
    sheet.columns = [
      { header: 'full_name', key: 'full_name', width: 30 },
      { header: 'grade_level', key: 'grade_level', width: 18 },
      { header: 'student_phone', key: 'student_phone', width: 18 },
      { header: 'school_name', key: 'school_name', width: 24 },
      { header: 'guardian_name', key: 'guardian_name', width: 28 },
      { header: 'guardian_phone', key: 'guardian_phone', width: 18 },
      { header: 'center_code', key: 'center_code', width: 16 },
      { header: 'notes', key: 'notes', width: 30 },
    ];
    sheet.addRow({ full_name: 'أحمد محمد علي', grade_level: 'الثالث الإعدادي', student_phone: '01000000000', school_name: 'مدرسة المثال', guardian_name: 'محمد علي', guardian_phone: '01100000000', center_code: 'C01', notes: '' });
    const instructions = workbook.addWorksheet('Instructions', { views: [{ rightToLeft: true }] });
    instructions.addRows([
      ['التعليمات'],
      ['لا تغيّر أسماء الأعمدة في Sheet Students.'],
      ['center_code يجب أن يكون موجودًا داخل النظام.'],
      ['الهواتف تقبل الصيغة المحلية المصرية أو E.164.'],
      ['يتم عرض Preview والأخطاء قبل الحفظ.'],
    ]);
    const buffer = await workbook.xlsx.writeBuffer();
    return { stream: new StreamableFile(Buffer.from(buffer)), fileName: 'students-import-template.xlsx' };
  }

  async upload(user: RequestUser, file: Express.Multer.File) {
    if (!file || file.mimetype !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
      throw new DomainError('IMPORT_FILE_INVALID', 'ارفع ملف XLSX صالحًا.', HttpStatus.UNSUPPORTED_MEDIA_TYPE);
    }
    await fs.mkdir(this.root, { recursive: true });
    const job = await this.prisma.importJob.create({
      data: {
        organizationId: user.organizationId,
        type: 'students',
        fileName: file.originalname,
        status: 'VALIDATING',
        createdById: user.id,
      },
    });
    const sourcePath = join(this.root, `${job.id}.xlsx`);
    await fs.writeFile(sourcePath, file.buffer);
    try {
      const rows = await this.parse(user, sourcePath);
      const validRows = rows.filter((row) => row.errors.length === 0).length;
      const invalidRows = rows.length - validRows;
      await this.prisma.importJob.update({
        where: { id: job.id },
        data: { sourcePath, totalRows: rows.length, validRows, invalidRows, status: invalidRows > 0 ? 'PARTIAL' : 'READY' },
      });
      return { id: job.id, totalRows: rows.length, validRows, invalidRows, preview: rows.slice(0, 100) };
    } catch (error) {
      await this.prisma.importJob.update({ where: { id: job.id }, data: { status: 'FAILED', sourcePath } });
      throw error;
    }
  }

  async preview(user: RequestUser, jobId: string) {
    const job = await this.getJob(user, jobId);
    if (!job.sourcePath) throw new DomainError('IMPORT_FILE_INVALID', 'ملف الاستيراد غير متاح.', HttpStatus.NOT_FOUND);
    const rows = await this.parse(user, job.sourcePath);
    return {
      id: job.id,
      status: job.status,
      totalRows: rows.length,
      validRows: rows.filter((row) => row.errors.length === 0).length,
      invalidRows: rows.filter((row) => row.errors.length > 0).length,
      rows: rows.slice(0, 250),
    };
  }

  async commit(user: RequestUser, jobId: string) {
    const job = await this.getJob(user, jobId);
    if (!job.sourcePath) throw new DomainError('IMPORT_FILE_INVALID', 'ملف الاستيراد غير متاح.', HttpStatus.NOT_FOUND);
    if (job.status === 'COMPLETED') throw new DomainError('IMPORT_ALREADY_COMMITTED', 'تم تنفيذ هذا الاستيراد مسبقًا.', HttpStatus.CONFLICT);
    const rows = await this.parse(user, job.sourcePath);
    const validRows = rows.filter((row) => row.errors.length === 0 && row.centerId);
    if (validRows.length === 0) throw new DomainError('IMPORT_HAS_ERRORS', 'لا توجد صفوف صالحة للاستيراد.', HttpStatus.CONFLICT);
    await this.prisma.importJob.update({ where: { id: job.id }, data: { status: 'IMPORTING' } });

    const failures: Array<{ rowNumber: number; message: string }> = [];
    let imported = 0;
    for (const row of validRows) {
      try {
        await this.students.create(user, {
          fullName: row.fullName,
          gradeLevel: row.gradeLevel,
          centerId: row.centerId!,
          guardianName: row.guardianName,
          guardianPhone: row.guardianPhone,
          studentPhone: row.studentPhone,
          schoolName: row.schoolName,
        });
        imported += 1;
      } catch (error) {
        failures.push({ rowNumber: row.rowNumber, message: error instanceof Error ? error.message : 'فشل غير معروف' });
      }
    }

    await this.prisma.importJob.update({
      where: { id: job.id },
      data: { status: failures.length > 0 ? 'PARTIAL' : 'COMPLETED', validRows: imported, invalidRows: rows.length - imported },
    });
    await this.prisma.auditLog.create({
      data: {
        organizationId: user.organizationId,
        actorUserId: user.id,
        action: 'IMPORT_COMMITTED',
        entityType: 'ImportJob',
        entityId: job.id,
        metadataJson: { imported, failures: failures.length },
      },
    });
    return { imported, failed: failures.length, failures };
  }

  private async parse(user: RequestUser, filePath: string): Promise<ParsedRow[]> {
    const safePath = resolve(filePath);
    if (!safePath.startsWith(this.root)) throw new DomainError('IMPORT_FILE_INVALID', 'مسار الملف غير صالح.');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(safePath);
    const sheet = workbook.getWorksheet('Students') ?? workbook.worksheets[0];
    if (!sheet) throw new DomainError('IMPORT_FILE_INVALID', 'الملف لا يحتوي على Sheet بيانات.');

    const headers = new Map<string, number>();
    sheet.getRow(1).eachCell((cell, column) => headers.set(String(cell.value ?? '').trim(), column));
    const required = ['full_name', 'grade_level', 'guardian_name', 'guardian_phone', 'center_code'];
    const missing = required.filter((header) => !headers.has(header));
    if (missing.length) throw new DomainError('IMPORT_COLUMNS_MISSING', 'أعمدة إلزامية غير موجودة.', HttpStatus.UNPROCESSABLE_ENTITY, { columns: missing });

    const centers = await this.prisma.center.findMany({ where: { organizationId: user.organizationId, archivedAt: null }, select: { id: true, code: true } });
    const centerByCode = new Map(centers.map((item) => [item.code.toLowerCase(), item]));
    const read = (row: ExcelJS.Row, key: string) => String(row.getCell(headers.get(key) ?? 0).value ?? '').trim();
    const rows: ParsedRow[] = [];

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const fullName = read(row, 'full_name');
      const gradeLevel = read(row, 'grade_level');
      const guardianName = read(row, 'guardian_name');
      const guardianPhone = read(row, 'guardian_phone');
      const centerCode = read(row, 'center_code');
      if (![fullName, gradeLevel, guardianName, guardianPhone, centerCode].some(Boolean)) return;
      const errors: string[] = [];
      if (!fullName) errors.push('اسم الطالب مطلوب.');
      if (!gradeLevel) errors.push('الصف مطلوب.');
      if (!guardianName) errors.push('اسم ولي الأمر مطلوب.');
      if (!guardianPhone) errors.push('هاتف ولي الأمر مطلوب.');
      const center = centerByCode.get(centerCode.toLowerCase());
      if (!center) errors.push('كود السنتر غير موجود.');
      rows.push({
        rowNumber,
        fullName,
        gradeLevel,
        studentPhone: read(row, 'student_phone') || undefined,
        schoolName: read(row, 'school_name') || undefined,
        guardianName,
        guardianPhone,
        centerCode,
        notes: read(row, 'notes') || undefined,
        centerId: center?.id,
        errors,
      });
    });
    if (rows.length > 5_000) throw new DomainError('IMPORT_FILE_TOO_LARGE', 'الحد الأقصى للاستيراد المتزامن 5000 صف.', HttpStatus.PAYLOAD_TOO_LARGE);
    return rows;
  }

  private async getJob(user: RequestUser, jobId: string) {
    const job = await this.prisma.importJob.findFirst({ where: { id: jobId, organizationId: user.organizationId } });
    if (!job) throw new DomainError('RESOURCE_NOT_FOUND', 'عملية الاستيراد غير موجودة.', HttpStatus.NOT_FOUND);
    return job;
  }
}
