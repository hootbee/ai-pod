import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { PipelineRunService } from './pipeline-run.service';
import { AuditAction } from '../../common/decorators/audit-action.decorator';

@Controller('admin/pipeline')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class PipelineRunController {
  constructor(private readonly pipelineRunService: PipelineRunService) {}

  @Get('runs')
  @AuditAction('pipeline_runs.read')
  listRuns(@Query('limit') limit?: string, @Query('offset') offset?: string) {
    return this.pipelineRunService.listRuns(Number(limit ?? 20), Number(offset ?? 0));
  }

  @Get('runs/:id')
  @AuditAction('pipeline_run.read')
  async findRun(@Param('id') id: string) {
    const run = await this.pipelineRunService.findRun(id);
    if (!run) return { data: null, steps: [] };
    return { data: run, steps: await this.pipelineRunService.findSteps(id) };
  }
}
