import 'package:flutter/material.dart';
import 'dart:math' as math;

class ClickWheel extends StatefulWidget {
  final VoidCallback onCenterTap;
  final VoidCallback onScrollRight;
  final VoidCallback onScrollLeft;
  final VoidCallback? onSwipeLeft;

  const ClickWheel({
    super.key,
    required this.onCenterTap,
    required this.onScrollRight,
    required this.onScrollLeft,
    this.onSwipeLeft,
  });

  @override
  State<ClickWheel> createState() => _ClickWheelState();
}

class _ClickWheelState extends State<ClickWheel> {
  double _lastAngle = 0.0;
  double _accumulatedAngle = 0.0;
  final double _scrollThreshold = 0.5;

  Offset? _panStartOffset;
  Offset? _panCurrentOffset;

  void _onPanStart(DragStartDetails details) {
    _panStartOffset = details.globalPosition;
    _panCurrentOffset = details.globalPosition;
    _lastAngle = _calculateAngle(details.localPosition);
  }

  void _onPanUpdate(DragUpdateDetails details) {
    _panCurrentOffset = details.globalPosition;

    final double currentAngle = _calculateAngle(details.localPosition);
    double delta = currentAngle - _lastAngle;

    // 360도 경계 처리
    if (delta > math.pi) delta -= 2 * math.pi;
    if (delta < -math.pi) delta += 2 * math.pi;

    _accumulatedAngle += delta;
    _lastAngle = currentAngle;

    // 휠 스크롤 감지
    if (_accumulatedAngle.abs() > _scrollThreshold) {
      if (_accumulatedAngle > 0) {
        widget.onScrollRight();
      } else {
        widget.onScrollLeft();
      }
      _accumulatedAngle = 0.0;
    }
  }

  void _onPanEnd(DragEndDetails details) {
    if (_panStartOffset != null && _panCurrentOffset != null) {
      final double dx = _panCurrentOffset!.dx - _panStartOffset!.dx;
      final double dy = _panCurrentOffset!.dy - _panStartOffset!.dy;

      // 플러터의 속도(Velocity) 물리 엔진을 활용해 '빠르게 튕겼는지(Flick)' 체크
      final double velocityX = details.velocity.pixelsPerSecond.dx;

      // [핵심 수정] 휠을 돌렸는지 여부와 상관없이,
      // X축으로 길게 밀었거나(-50 이상) 왼쪽으로 빠르게 튕겼고(속도 -300 이하),
      // 위아래(Y축)로 크게 안 벗어났다면 스와이프로 강력하게 판정!
      if ((dx < -50 || velocityX < -300) && dy.abs() < 100) {
        widget.onSwipeLeft?.call();
      }
    }

    // 초기화
    _panStartOffset = null;
    _panCurrentOffset = null;
  }

  // 각도 계산을 별도 함수로 분리 (중앙 좌표를 유연하게 잡기 위함)
  double _calculateAngle(Offset localPosition) {
    // 다이얼이 화면 중앙에 배치되므로, 컨테이너의 중심(가로 정중앙)을 기준으로 각도를 계산합니다.
    final Size screenSize = MediaQuery.of(context).size;
    final Offset center = Offset(screenSize.width / 2, 110);
    return math.atan2(
      localPosition.dy - center.dy,
      localPosition.dx - center.dx,
    );
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onPanStart: _onPanStart,
      onPanUpdate: _onPanUpdate,
      onPanEnd: _onPanEnd,
      // [핵심 수정] behavior를 opaque로 설정하여 다이얼 바깥의 빈 '여백'을 만져도 제스처를 인식하게 만듭니다.
      behavior: HitTestBehavior.opaque,
      child: Container(
        // 제스처 인식 영역을 가로 전체(double.infinity)로 확장
        width: double.infinity,
        height: 220,
        alignment: Alignment.center,
        child: Container(
          width: 220,
          height: 220,
          decoration: const BoxDecoration(
            color: Color(0xFFE2E2E2),
            shape: BoxShape.circle,
          ),
          child: Stack(
            alignment: Alignment.center,
            children: [
              GestureDetector(
                onTap: widget.onCenterTap,
                child: Container(
                  width: 90,
                  height: 90,
                  decoration: const BoxDecoration(
                    color: Color(0xFF1E211A),
                    shape: BoxShape.circle,
                  ),
                ),
              ),
              Positioned(
                top: 20,
                child: IgnorePointer(
                  child: Container(
                    width: 16,
                    height: 16,
                    decoration: BoxDecoration(
                      color: Colors.black.withOpacity(0.15),
                      shape: BoxShape.circle,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
