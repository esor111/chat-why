import { Module } from '@nestjs/common';
import { SanitizationService } from './services/sanitization.service';
import { AuditService } from './services/audit.service';

@Module({
  providers: [SanitizationService, AuditService],
  exports: [SanitizationService, AuditService],
})
export class CommonModule {}