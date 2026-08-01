import { Global, Module } from '@nestjs/common';
import { ScopeService } from './scope.service';
import { RbacController } from './rbac.controller';

@Global()
@Module({ controllers: [RbacController], providers: [ScopeService], exports: [ScopeService] })
export class RbacModule {}
