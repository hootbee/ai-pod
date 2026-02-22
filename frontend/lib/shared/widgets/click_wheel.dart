import 'package:flutter/material.dart';
import 'dart:math' as math;

class ClickWheel extends StatefulWidget {
  final VoidCallback onCenterTap; // 가운데 버튼 클릭 시 실행할 함수
  final VoidCallback onScrollRight; // 시계 방향 회전 시 실행할 함수 (다음)
  final VoidCallback onScrollLeft; // 반시계 방향 회전 시 실행할 함수 (이전)

  const ClickWheel({
    super.key,
    required this.onCenterTap,
    required this.onScrollRight,
    required this.onScrollLeft,
  });

  @override
  State<ClickWheel> createState() => _ClickWheelState();
}

class _ClickWheelState extends State<ClickWheel> {
  double _lastAngle = 0.0;
  double _accumulatedAngle = 0.0;

  // 휠의 민감도 (이 값이 작을수록 조금만 돌려도 잘 넘어갑니다)
  final double _scrollThreshold = 0.5;

  void _onPanStart(DragStartDetails details) {
    // 터치 시작 시점의 각도 계산
    final Offset center = Offset(110, 110); // 휠 크기(220)의 절반
    _lastAngle = math.atan2(
      details.localPosition.dy - center.dy,
      details.localPosition.dx - center.dx,
    );
  }

  void _onPanUpdate(DragUpdateDetails details) {
    final Offset center = Offset(110, 110);
    final double currentAngle = math.atan2(
      details.localPosition.dy - center.dy,
      details.localPosition.dx - center.dx,
    );

    // 각도 변화량 계산
    double delta = currentAngle - _lastAngle;

    // 360도(2PI) 경계선 자연스럽게 넘어가기 위한 처리
    if (delta > math.pi) delta -= 2 * math.pi;
    if (delta < -math.pi) delta += 2 * math.pi;

    _accumulatedAngle += delta;
    _lastAngle = currentAngle;

    // 누적된 각도가 임계치를 넘으면 스크롤 이벤트 발생
    if (_accumulatedAngle > _scrollThreshold) {
      widget.onScrollRight(); // 시계 방향
      _accumulatedAngle = 0.0; // 초기화
    } else if (_accumulatedAngle < -_scrollThreshold) {
      widget.onScrollLeft(); // 반시계 방향
      _accumulatedAngle = 0.0; // 초기화
    }
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onPanStart: _onPanStart,
      onPanUpdate: _onPanUpdate,
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
            // 가운데 클릭 버튼
            GestureDetector(
              onTap: widget.onCenterTap,
              child: Container(
                width: 90,
                height: 90,
                decoration: const BoxDecoration(
                  color: Color(0xFF1E211A), // 배경색과 맞춤
                  shape: BoxShape.circle,
                ),
              ),
            ),
            // 상단 인디케이터 (디자인 포인트)
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
    );
  }
}
