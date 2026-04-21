import 'package:flutter/material.dart';
import 'dart:math' as math;

class ClickWheel extends StatefulWidget {
  final VoidCallback onCenterTap;
  final VoidCallback onScrollRight;
  final VoidCallback onScrollLeft;

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
  double _visualRotation = 0.0; 
  
  final double _scrollThreshold = 0.5;

  void _onPanStart(DragStartDetails details) {
    _lastAngle = _calculateAngle(details.localPosition);
  }

  void _onPanUpdate(DragUpdateDetails details) {
    final double currentAngle = _calculateAngle(details.localPosition);
    double delta = currentAngle - _lastAngle;

    if (delta > math.pi) delta -= 2 * math.pi;
    if (delta < -math.pi) delta += 2 * math.pi;

    setState(() {
      _visualRotation += delta; 
      _accumulatedAngle += delta;
    });
    
    _lastAngle = currentAngle;

    if (_accumulatedAngle > _scrollThreshold) {
      widget.onScrollRight();
      _accumulatedAngle -= _scrollThreshold; 
    } else if (_accumulatedAngle < -_scrollThreshold) {
      widget.onScrollLeft();
      _accumulatedAngle += _scrollThreshold; 
    }
  }

  double _calculateAngle(Offset localPosition) {
    // ★ 터치 영역이 다이얼 크기(220)로 딱 맞춰졌으므로 중심점은 (110, 110) 입니다.
    const Offset center = Offset(110, 110);
    return math.atan2(
      localPosition.dy - center.dy,
      localPosition.dx - center.dx,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      height: 220,
      alignment: Alignment.center,
      // ★ 핵심: 다이얼을 덮고 있는 컨테이너 안으로 GestureDetector를 옮겼습니다!
      // 이제 빈 여백을 터치해도 다이얼이 돌아가거나 반응하지 않습니다.
      child: GestureDetector(
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
              Transform.rotate(
                angle: _visualRotation,
                child: Align(
                  alignment: Alignment.topCenter,
                  child: Padding(
                    padding: const EdgeInsets.only(top: 20),
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
                ),
              ),
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
            ],
          ),
        ),
      ),
    );
  }
}