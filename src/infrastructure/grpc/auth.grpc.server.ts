// src/infrastructure/grpc/auth.grpc.server.ts
//
// This gRPC server exposes internal methods consumed by other services.
// In production, this would run as a separate process / sidecar.
// Kept co-located here to illustrate the pattern without full service split.

import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import { tokenService }          from '@services/auth/infrastructure/services/token.service';
import { UserPrismaRepository }  from '@services/auth/infrastructure/repositories/user.prisma.repository';
import { createLogger }          from '@infrastructure/logger';
import { config }                from '@shared/config';

const log = createLogger('gRPC:AuthServer');

// ─── Proto Loading ────────────────────────────────────────────────────────────
const PROTO_PATH = path.join(process.cwd(), 'proto', 'auth.proto');

const packageDef = protoLoader.loadSync(PROTO_PATH, {
  keepCase:     true,
  longs:        String,
  enums:        String,
  defaults:     true,
  oneofs:       true,
});

// @ts-ignore — dynamic proto loading
const grpcObj = grpc.loadPackageDefinition(packageDef).fintrack.auth.v1 as any;

// ─── Service Implementations ──────────────────────────────────────────────────
const userRepo = new UserPrismaRepository();

async function validateToken(
  call: grpc.ServerUnaryCall<any, any>,
  callback: grpc.sendUnaryData<any>,
): Promise<void> {
  try {
    const { access_token } = call.request;
    const payload = await tokenService.verifyAccessToken(access_token);

    callback(null, {
      valid:      true,
      user_id:    payload.sub,
      email:      payload.email,
      role:       payload.role,
      session_id: payload.sessionId,
      error:      '',
    });
  } catch (err) {
    callback(null, {
      valid: false,
      error: (err as Error).message,
    });
  }
}

async function getUser(
  call: grpc.ServerUnaryCall<any, any>,
  callback: grpc.sendUnaryData<any>,
): Promise<void> {
  try {
    const user = await userRepo.findById(call.request.user_id);
    if (!user) {
      return callback({
        code:    grpc.status.NOT_FOUND,
        message: 'User not found',
      });
    }

    callback(null, {
      id:         user.id,
      email:      user.email,
      first_name: user.firstName,
      last_name:  user.lastName,
      role:       user.role,
      is_active:  user.isActive,
    });
  } catch (err) {
    callback({ code: grpc.status.INTERNAL, message: (err as Error).message });
  }
}

// ─── Server Lifecycle ─────────────────────────────────────────────────────────
let grpcServer: grpc.Server | null = null;

export function startGrpcServer(): void {
  grpcServer = new grpc.Server();

  grpcServer.addService(grpcObj.AuthService.service, {
    ValidateToken: validateToken,
    GetUser:       getUser,
  });

  const address = `0.0.0.0:${config.GRPC_AUTH_PORT}`;
  grpcServer.bindAsync(address, grpc.ServerCredentials.createInsecure(), (err, port) => {
    if (err) {
      log.error({ err }, 'gRPC server failed to start');
      return;
    }
    grpcServer!.start();
    log.info({ port }, 'gRPC Auth server started');
  });
}

export function stopGrpcServer(): void {
  grpcServer?.forceShutdown();
  log.info('gRPC server stopped');
}
