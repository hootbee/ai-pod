import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_cache_manager/flutter_cache_manager.dart';
import 'package:just_audio/just_audio.dart' show AudioSource;
import 'package:shared_preferences/shared_preferences.dart';

import 'audio_cache_helper.dart';

// ─────────────────────────────────────────────────────────────────────────────
// 1. 이미지 캐시 매니저 (7일 유지, 최대 300개)
// ─────────────────────────────────────────────────────────────────────────────
class AppImageCacheManager extends CacheManager with ImageCacheManager {
  static const _cacheKey = 'aipodImageCache';

  static final AppImageCacheManager instance = AppImageCacheManager._();

  AppImageCacheManager._()
      : super(Config(
          _cacheKey,
          stalePeriod: const Duration(days: 7),
          maxNrOfCacheObjects: 300,
        ));
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. ETag 인터셉터
//    - GET 요청 시 저장된 ETag를 If-None-Match 헤더로 전송
//    - 200 응답 시 ETag + 바디를 SharedPreferences에 저장
//    - 304 응답 시 저장된 바디를 200으로 변환하여 반환
// ─────────────────────────────────────────────────────────────────────────────
class _ETagCacheInterceptor extends Interceptor {
  // ETag 캐시 제외 경로: 재생성 후 최신 데이터가 즉시 반영돼야 하는 API
  static const _noCache = ['/card-news'];

  static bool _isCacheable(Uri uri) =>
      !_noCache.any((p) => uri.path.contains(p));

  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    if (options.method == 'GET' && _isCacheable(options.uri)) {
      final prefs = await SharedPreferences.getInstance();
      final etag = prefs.getString('etag:${options.uri}');
      if (etag != null) {
        options.headers['If-None-Match'] = etag;
      }
    }
    handler.next(options);
  }

  @override
  Future<void> onResponse(
    Response response,
    ResponseInterceptorHandler handler,
  ) async {
    final uri = response.requestOptions.uri;

    // 304 → 캐시 데이터 반환
    if (response.statusCode == 304 && _isCacheable(uri)) {
      final prefs = await SharedPreferences.getInstance();
      final cached = prefs.getString('cache:$uri');
      if (cached != null) {
        handler.resolve(
          Response(
            requestOptions: response.requestOptions,
            data: jsonDecode(cached),
            statusCode: 200,
            headers: response.headers,
          ),
        );
        return;
      }
    }

    // 200 + GET → ETag와 바디 저장
    if (response.statusCode == 200 &&
        response.requestOptions.method == 'GET' &&
        _isCacheable(uri)) {
      final etag = response.headers.value('etag');
      if (etag != null) {
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('etag:$uri', uri.toString());
        await prefs.setString('cache:$uri', jsonEncode(response.data));
      }
    }

    handler.next(response);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. NetworkCacheService 싱글톤
// ─────────────────────────────────────────────────────────────────────────────
class NetworkCacheService {
  static final NetworkCacheService _instance =
      NetworkCacheService._internal();
  static NetworkCacheService get instance => _instance;

  late final Dio _dio;

  /// ETag 캐싱이 적용된 전역 Dio 인스턴스
  Dio get dio => _dio;

  NetworkCacheService._internal() {
    _dio = Dio(
      BaseOptions(
        connectTimeout: const Duration(seconds: 10),
        receiveTimeout: const Duration(seconds: 10),
        // 304 Not Modified도 정상 응답으로 처리
        validateStatus: (status) => status != null && status < 400,
      ),
    );
    _dio.interceptors.add(_ETagCacheInterceptor());
  }

  /// 오디오 URL에 대해 캐싱 AudioSource를 반환.
  /// 웹은 파일 시스템 접근 불가 → URL 직접 재생.
  /// 모바일/데스크톱은 LockCachingAudioSource로 스트리밍+로컬 저장.
  /// [headers]: JWT 인증 헤더 등 (스트림 엔드포인트가 JwtAuthGuard 적용 시 필수)
  Future<AudioSource> getCachedAudioSource(String url, {Map<String, String>? headers, Object? tag}) {
    return buildCachedAudioSource(url, headers: headers, tag: tag);
  }
}
