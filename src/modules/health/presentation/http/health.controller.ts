import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  HealthCheck,
  HealthCheckService,
  HealthIndicatorService,
  MemoryHealthIndicator,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RedisHealthIndicator } from '../../infrastructure/redis.health-indicator';

const DEPENDENCY_TIMEOUT_MS = 1500;
const MB = 1024 * 1024;

/**
 * Public, unauthenticated probes. Any `down` indicator turns the response into
 * HTTP 503, so pipelines and orchestrators can rely on the status code alone.
 */
@ApiTags('health')
@Controller('health')
export class HealthController {
  private readonly heapLimitBytes: number;
  private readonly rssLimitBytes: number;

  constructor(
    private readonly health: HealthCheckService,
    private readonly healthIndicatorService: HealthIndicatorService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly redis: RedisHealthIndicator,
    private readonly memory: MemoryHealthIndicator,
    config: ConfigService,
  ) {
    this.heapLimitBytes = Number(config.get('HEALTH_MEMORY_HEAP_MB', '512')) * MB;
    this.rssLimitBytes = Number(config.get('HEALTH_MEMORY_RSS_MB', '1024')) * MB;
  }

  @Get('live')
  @HealthCheck()
  @ApiOperation({
    summary: 'Liveness: the process is up and serving HTTP (no dependency checks)',
  })
  live() {
    return this.health.check([() => this.app()]);
  }

  @Get()
  @HealthCheck()
  @ApiOperation({
    summary: 'Readiness: app, database, Redis and memory. 503 if any check is down',
  })
  ready() {
    return this.health.check([
      () => this.app(),
      () => this.db.pingCheck('database').withTimeout(DEPENDENCY_TIMEOUT_MS),
      () => this.redis.pingCheck('redis', DEPENDENCY_TIMEOUT_MS),
      () => this.memory.checkHeap('memory_heap', this.heapLimitBytes),
      () => this.memory.checkRSS('memory_rss', this.rssLimitBytes),
    ]);
  }

  private app() {
    return this.healthIndicatorService.check('app').up({
      uptimeSeconds: Math.round(process.uptime()),
      version: process.env.APP_VERSION ?? process.env.npm_package_version ?? 'unknown',
    });
  }
}
