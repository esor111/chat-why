import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from '../../auth/auth.guard';
import { DatabasePerformanceService, DatabaseMetrics } from '../services/database-performance.service';

@ApiTags('Database Performance')
@Controller('admin/database')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class DatabasePerformanceController {
  constructor(
    private readonly databasePerformanceService: DatabasePerformanceService,
  ) {}

  @Get('metrics')
  @ApiOperation({ summary: 'Get database performance metrics' })
  @ApiResponse({ status: 200, description: 'Database metrics retrieved successfully' })
  async getDatabaseMetrics(): Promise<DatabaseMetrics> {
    return this.databasePerformanceService.getDatabaseMetrics();
  }

  @Get('size')
  @ApiOperation({ summary: 'Get database size information' })
  @ApiResponse({ status: 200, description: 'Database size information retrieved successfully' })
  async getDatabaseSize() {
    return this.databasePerformanceService.getDatabaseSize();
  }

  @Get('index-suggestions')
  @ApiOperation({ summary: 'Get index optimization suggestions' })
  @ApiResponse({ status: 200, description: 'Index suggestions retrieved successfully' })
  async getIndexSuggestions() {
    const suggestions = await this.databasePerformanceService.checkMissingIndexes();
    return { suggestions };
  }

  @Post('analyze-query')
  @ApiOperation({ summary: 'Analyze query performance' })
  @ApiQuery({ name: 'query', description: 'SQL query to analyze' })
  @ApiResponse({ status: 200, description: 'Query analysis completed successfully' })
  async analyzeQuery(@Query('query') query: string) {
    return this.databasePerformanceService.analyzeQuery(query);
  }

  @Post('optimize')
  @ApiOperation({ summary: 'Optimize database performance' })
  @ApiResponse({ status: 200, description: 'Database optimization completed successfully' })
  async optimizeDatabase() {
    await this.databasePerformanceService.optimizeDatabase();
    return { message: 'Database optimization completed successfully' };
  }
}