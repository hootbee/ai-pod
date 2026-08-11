import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { GoogleLoginDto } from './dto/google-login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import type { TokenPayload } from './interfaces/token.service.interface';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('google')
  @HttpCode(HttpStatus.OK)
  loginWithGoogle(@Body() dto: GoogleLoginDto, @Req() request: Request) {
    return this.authService.loginWithGoogle(
      dto.idToken,
      dto.accessToken,
      this.auditContext(request),
    );
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshDto, @Req() request: Request) {
    return this.authService.refresh(dto.refreshToken, this.auditContext(request));
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @CurrentUser() user: TokenPayload,
    @Body() dto: RefreshDto,
    @Req() request: Request,
  ): Promise<void> {
    await this.authService.logout(user.sub, dto.refreshToken, this.auditContext(request));
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: TokenPayload) {
    return this.authService.me(user.sub);
  }

  private auditContext(request: Request) {
    const requestId = request.headers['x-request-id'];

    return {
      ipAddress: request.ip,
      userAgent: request.get('user-agent'),
      deviceId: request.get('x-device-id'),
      requestId: Array.isArray(requestId) ? requestId[0] : requestId,
    };
  }
}
