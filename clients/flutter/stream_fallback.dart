import 'dart:async';
import 'dart:convert';
import 'dart:io';

/// Playlist URL from either Cloudflare or AWS.
class ResolvedStream {
  const ResolvedStream({
    required this.url,
    required this.source,
    required this.expiresIn,
    required this.type,
  });

  final String url;

  /// `cloudflare` or `aws`.
  final String source;
  final int expiresIn;
  final String type;
}

/// Play path: Worker first, then `GET /stream` on AWS.
///
/// If the player errors on a Cloudflare URL, call
/// `resolve(pageUrl, skipCloudflare: true)` and play that result.
class StreamFallbackClient {
  StreamFallbackClient({
    required this.workerBaseUrl,
    required this.apiBaseUrl,
    this.apiKey,
    this.workerKey,
    this.workerTimeout = const Duration(seconds: 8),
    this.awsTimeout = const Duration(seconds: 20),
    HttpClient? httpClient,
  }) : _client = httpClient ?? HttpClient();

  /// Worker origin plus path, without a query string. Example:
  /// `https://movies-stream.<account>.workers.dev`
  final String workerBaseUrl;
  final String apiBaseUrl;
  final String? apiKey;
  final String? workerKey;
  final Duration workerTimeout;
  final Duration awsTimeout;
  final HttpClient _client;

  Future<ResolvedStream> resolve(
    String pageUrl, {
    bool skipCloudflare = false,
  }) async {
    final page = pageUrl.trim();
    if (page.isEmpty) {
      throw StateError('pageUrl is required');
    }

    if (!skipCloudflare && workerBaseUrl.trim().isNotEmpty) {
      try {
        final fromWorker = await _getJson(
          _withQuery(workerBaseUrl, page),
          timeout: workerTimeout,
          headers: {
            if (workerKey != null && workerKey!.isNotEmpty)
              'X-Stream-Key': workerKey!,
          },
        );
        final stream = _read(fromWorker);
        if (stream != null) {
          return ResolvedStream(
            url: stream.url,
            source: 'cloudflare',
            expiresIn: stream.expiresIn,
            type: stream.type,
          );
        }
      } catch (_) {
        // AWS is the fallback.
      }
    }

    final fromAws = await _getJson(
      _withQuery('${_trim(apiBaseUrl)}/stream', page),
      timeout: awsTimeout,
      headers: {
        if (apiKey != null && apiKey!.isNotEmpty) 'X-Api-Key': apiKey!,
      },
    );
    final stream = _read(fromAws);
    if (stream == null) {
      throw StateError('AWS stream request failed');
    }
    return ResolvedStream(
      url: stream.url,
      source: 'aws',
      expiresIn: stream.expiresIn,
      type: stream.type,
    );
  }

  String _withQuery(String base, String pageUrl) {
    final trimmed = _trim(base);
    final join = trimmed.contains('?') ? '&' : '?';
    return '$trimmed${join}url=${Uri.encodeQueryComponent(pageUrl)}';
  }

  String _trim(String value) => value.replaceAll(RegExp(r'/+$'), '');

  Future<Map<String, dynamic>?> _getJson(
    String url, {
    required Duration timeout,
    Map<String, String> headers = const {},
  }) async {
    final request = await _client.getUrl(Uri.parse(url)).timeout(timeout);
    request.headers.set(HttpHeaders.acceptHeader, 'application/json');
    headers.forEach(request.headers.set);
    final response = await request.close().timeout(timeout);
    final text = await utf8.decoder.bind(response).join().timeout(timeout);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      return null;
    }
    final decoded = jsonDecode(text);
    if (decoded is Map<String, dynamic>) return decoded;
    if (decoded is Map) return Map<String, dynamic>.from(decoded);
    return null;
  }

  _StreamBits? _read(Map<String, dynamic>? body) {
    final stream = body?['stream'];
    if (stream is! Map) return null;
    final url = stream['url'];
    if (url is! String || url.isEmpty) return null;
    final expires = stream['expiresIn'];
    final type = stream['type'];
    return _StreamBits(
      url: url,
      expiresIn: expires is num ? expires.toInt() : 0,
      type: type is String && type.isNotEmpty
          ? type
          : (url.contains('.mp4') ? 'mp4' : 'm3u8'),
    );
  }
}

class _StreamBits {
  const _StreamBits({
    required this.url,
    required this.expiresIn,
    required this.type,
  });

  final String url;
  final int expiresIn;
  final String type;
}
