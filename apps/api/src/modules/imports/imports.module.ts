import { Module } from '@nestjs/common';
import { StudentsModule } from '../students/students.module';
import { ImportsController } from './imports.controller';
import { ImportsService } from './imports.service';

@Module({ imports: [StudentsModule], controllers: [ImportsController], providers: [ImportsService] })
export class ImportsModule {}
