import { ExpressAdapter } from '@bull-board/express';
import { BullBoardModule } from '@bull-board/nestjs';
import { createKeyv } from '@keyv/redis';
import { BullModule } from '@nestjs/bullmq';
import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import basicAuth from 'basic-auth-connect';
import { CacheableMemory } from 'cacheable';
import { Keyv } from 'keyv';

import { AuthModule } from '@/auth/auth.module';
import {
	CONFIG_MOUNTS,
	CONFIG_TOKENS,
	CONSTANTS,
	RedisConfig,
	corsConfig,
	redisConfig,
} from '@/configs';
import { DomainModule } from '@/domains/domain.module';
import { PrismaModule } from '@/providers/prisma/prisma.module';
import { QueueModule } from '@/queue/queue.module';

@Module({
	imports: [
		BullModule.forRootAsync({
			inject: [ConfigService],
			useFactory: (configService: ConfigService) => {
				const config = configService.get<RedisConfig>(CONFIG_TOKENS.REDIS);

				if (!config?.url) {
					throw new Error(
						'Redis configuration is not set. Please check your environment variables or configuration files.',
					);
				}

				return {
					connection: {
						url: config.url,
					},
				};
			},
		}),
		CacheModule.registerAsync({
			inject: [ConfigService],
			useFactory: (configService: ConfigService) => {
				const config = configService.get<RedisConfig>(CONFIG_TOKENS.REDIS);

				if (!config?.url) {
					throw new Error(
						'Redis configuration is not set. Please check your environment variables or configuration files.',
					);
				}

				return {
					stores: [
						new Keyv({
							store: new CacheableMemory({
								ttl: CONSTANTS.TTL,
								lruSize: CONSTANTS.LRU_SIZE,
							}),
						}),
						createKeyv(config.url),
					],
				};
			},
			isGlobal: true,
		}),
		ConfigModule.forRoot({
			load: [corsConfig, redisConfig],
			cache: true,
			isGlobal: true,
		}),
		PrismaModule,
		AuthModule,
		DomainModule,
		QueueModule,
		BullBoardModule.forRootAsync({
			inject: [ConfigService],
			useFactory: (configService: ConfigService) => {
				const config = configService.get<RedisConfig>(CONFIG_TOKENS.REDIS);

				if (!config?.bullmq?.username || !config?.bullmq?.password) {
					throw new Error(
						'BullMQ configuration is not set. Please check your environment variables or configuration files.',
					);
				}

				return {
					route: `/${CONFIG_MOUNTS.BULL_BOARD}`,
					adapter: ExpressAdapter,
					middleware: basicAuth(config.bullmq.username, config.bullmq.password),
				};
			},
		}),
	],
})
export class AppModule {}
