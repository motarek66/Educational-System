import { HttpStatus, Injectable } from '@nestjs/common';
import { ExamStatus, GradeStatus, Prisma } from '@prisma/client';
import { DomainError } from '../../common/errors/domain-error';
import type { RequestUser } from '../../common/guards/auth.guard';
import { PrismaService } from '../../database/prisma.service';
import { ScopeService } from '../rbac/scope.service';
import { BulkGradesDto, CreateExamDto } from './exams.dto';

@Injectable()
export class ExamsService {
  constructor(private readonly prisma: PrismaService, private readonly scope: ScopeService) {}

  async list(user: RequestUser) {
    const exams = await this.prisma.exam.findMany({
      where: {
        organizationId: user.organizationId,
        lessonId: null,
        assignments: { some: { center: this.scope.centerWhere(user) } },
      },
      include: {
        _count: { select: { assignments: true, grades: { where: { status: { not: GradeStatus.NOT_SUBMITTED } } } } },
      },
      orderBy: { examDate: 'desc' },
    });
    return exams.map((exam) => ({
      id: exam.id,
      name: exam.name,
      type: exam.type,
      examDate: exam.examDate.toISOString(),
      maxScore: Number(exam.maxScore),
      status: exam.status,
      centersCount: exam._count.assignments,
      gradedCount: exam._count.grades,
    }));
  }

  async create(user: RequestUser, dto: CreateExamDto) {
    const centers = await this.prisma.center.findMany({
      where: { id: { in: dto.centerIds }, ...this.scope.centerWhere(user), archivedAt: null },
    });
    if (centers.length !== dto.centerIds.length) {
      throw new DomainError('RESOURCE_OUT_OF_SCOPE', 'أحد السناتر غير موجود أو خارج نطاقك.', HttpStatus.NOT_FOUND);
    }
    const academicYear = await this.prisma.academicYear.findFirst({
      where: { organizationId: user.organizationId, status: 'ACTIVE' },
      orderBy: [{ isDefault: 'desc' }, { startDate: 'desc' }],
    });
    if (!academicYear) throw new DomainError('ACADEMIC_YEAR_CLOSED', 'لا توجد سنة دراسية نشطة.', HttpStatus.CONFLICT);
    if (dto.passScore !== undefined && dto.passScore > dto.maxScore) {
      throw new DomainError('GRADE_OUT_OF_RANGE', 'درجة النجاح لا يمكن أن تتجاوز الدرجة النهائية.');
    }

    return this.prisma.exam.create({
      data: {
        organizationId: user.organizationId,
        academicYearId: academicYear.id,
        name: dto.name,
        type: dto.type,
        examDate: new Date(dto.examDate),
        maxScore: dto.maxScore,
        passScore: dto.passScore,
        createdById: user.id,
        assignments: {
          create: centers.map((center) => ({ centerId: center.id })),
        },
      },
    });
  }

  async gradebook(user: RequestUser, examId: string) {
    const exam = await this.getScopedExam(user, examId);
    const centerIds = exam.assignments.map(({ centerId }) => centerId);
    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        organizationId: user.organizationId,
        centerId: { in: centerIds },
        academicYearId: exam.academicYearId,
        status: 'ACTIVE',
        ...(exam.lessonId ? { attendance: { some: { lessonId: exam.lessonId } } } : {}),
      },
      include: {
        profile: { include: { student: true } },
        grades: { where: { examId }, take: 1 },
      },
      orderBy: { profile: { student: { fullName: 'asc' } } },
    });
    return {
      exam: {
        id: exam.id,
        name: exam.name,
        maxScore: Number(exam.maxScore),
        status: exam.status,
      },
      rows: enrollments.map((enrollment) => {
        const grade = enrollment.grades[0];
        return {
          enrollmentId: enrollment.id,
          studentId: enrollment.profile.studentId,
          studentCode: enrollment.profile.studentCode,
          fullName: enrollment.profile.student.fullName,
          score: grade?.score === null || grade?.score === undefined ? null : Number(grade.score),
          status: grade?.status ?? GradeStatus.NOT_SUBMITTED,
        };
      }),
    };
  }

  async saveGrades(user: RequestUser, examId: string, dto: BulkGradesDto) {
    const exam = await this.getScopedExam(user, examId);
    if (exam.status !== ExamStatus.DRAFT && exam.status !== ExamStatus.OPEN_FOR_GRADING) {
      throw new DomainError(
        exam.status === ExamStatus.LOCKED ? 'EXAM_LOCKED' : 'EXAM_PUBLISHED',
        'لا يمكن تعديل درجات هذا الامتحان من المسار العادي.',
        HttpStatus.CONFLICT,
      );
    }
    const maxScore = Number(exam.maxScore);
    const enrollmentIds = dto.grades.map(({ enrollmentId }) => enrollmentId);
    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        id: { in: enrollmentIds },
        organizationId: user.organizationId,
        centerId: { in: exam.assignments.map(({ centerId }) => centerId) },
        academicYearId: exam.academicYearId,
        ...(exam.lessonId ? { attendance: { some: { lessonId: exam.lessonId } } } : {}),
      },
      include: { profile: true },
    });
    const enrollmentMap = new Map(enrollments.map((item) => [item.id, item]));
    if (enrollments.length !== new Set(enrollmentIds).size) {
      throw new DomainError('RESOURCE_OUT_OF_SCOPE', 'إحدى درجات الطلاب خارج نطاق الامتحان.', HttpStatus.NOT_FOUND);
    }

    for (const item of dto.grades) {
      if (item.status === GradeStatus.GRADED) {
        if (item.score === null || item.score < 0 || item.score > maxScore) {
          throw new DomainError('GRADE_OUT_OF_RANGE', `الدرجة يجب أن تكون بين 0 و${maxScore}.`, HttpStatus.UNPROCESSABLE_ENTITY);
        }
      } else if (item.score !== null) {
        throw new DomainError('GRADE_STATUS_CONFLICT', 'لا يمكن إدخال درجة مع حالة غائب أو بعذر.');
      }
    }

    await this.prisma.$transaction(async (tx) => {
      for (const item of dto.grades) {
        const enrollment = enrollmentMap.get(item.enrollmentId)!;
        const percentage = item.status === GradeStatus.GRADED && item.score !== null
          ? new Prisma.Decimal((item.score / maxScore) * 100)
          : null;
        const existing = await tx.grade.findUnique({ where: { examId_enrollmentId: { examId, enrollmentId: item.enrollmentId } } });
        const grade = existing
          ? await tx.grade.update({
              where: { id: existing.id },
              data: { score: item.score, status: item.status, percentage, enteredById: user.id },
            })
          : await tx.grade.create({
              data: {
                organizationId: user.organizationId,
                examId,
                enrollmentId: item.enrollmentId,
                studentId: enrollment.profile.studentId,
                score: item.score,
                status: item.status,
                percentage,
                enteredById: user.id,
              },
            });
        const scoreChanged = Number(existing?.score ?? 0) !== Number(item.score ?? 0);
        if (existing && (scoreChanged || existing.status !== item.status)) {
          await tx.gradeChangeHistory.create({
            data: {
              gradeId: grade.id,
              oldScore: existing.score,
              newScore: item.score,
              oldStatus: existing.status,
              newStatus: item.status,
              reason: exam.lessonId ? 'تعديل درجة الحصة من الاختبارات' : 'تعديل درجة الامتحان',
              changedById: user.id,
            },
          });
        }
      }
    });
    return { saved: dto.grades.length };
  }

  async publish(user: RequestUser, examId: string) {
    const exam = await this.getScopedExam(user, examId);
    if (exam.status !== ExamStatus.DRAFT && exam.status !== ExamStatus.OPEN_FOR_GRADING) {
      throw new DomainError('EXAM_PUBLISHED', 'تم نشر الامتحان أو قفله بالفعل.', HttpStatus.CONFLICT);
    }
    const centerIds = exam.assignments.map(({ centerId }) => centerId);
    const [expected, entered] = await this.prisma.$transaction([
      exam.lessonId
        ? this.prisma.attendanceRecord.count({ where: { lessonId: exam.lessonId } })
        : this.prisma.enrollment.count({ where: { centerId: { in: centerIds }, academicYearId: exam.academicYearId, status: 'ACTIVE' } }),
      this.prisma.grade.count({ where: { examId, status: { not: GradeStatus.NOT_SUBMITTED } } }),
    ]);
    if (entered < expected) {
      throw new DomainError('EXAM_HAS_INCOMPLETE_GRADES', 'توجد درجات غير مكتملة. أكملها أو حدد حالة الطالب قبل النشر.', HttpStatus.CONFLICT, { expected, entered });
    }
    return this.prisma.$transaction(async (tx) => {
      const publishedAt = new Date();
      const updated = await tx.exam.update({
        where: { id: examId },
        data: { status: ExamStatus.PUBLISHED, publishedAt },
      });
      await tx.grade.updateMany({ where: { examId }, data: { publishedAt } });
      await tx.auditLog.create({
        data: {
          organizationId: user.organizationId,
          actorUserId: user.id,
          action: 'EXAM_PUBLISHED',
          entityType: 'Exam',
          entityId: examId,
        },
      });
      return updated;
    });
  }

  private async getScopedExam(user: RequestUser, examId: string) {
    const exam = await this.prisma.exam.findFirst({
      where: {
        id: examId,
        organizationId: user.organizationId,
        assignments: { some: { center: this.scope.centerWhere(user) } },
      },
      include: { assignments: true },
    });
    if (!exam) throw new DomainError('RESOURCE_NOT_FOUND', 'الامتحان غير موجود.', HttpStatus.NOT_FOUND);
    return exam;
  }
}
