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
                        width: 20,
                        height: 20,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: const Color(0xFFC0C0C0), 
                            boxShadow: [
                            BoxShadow(
                              color: Colors.white.withValues(alpha: 0.8),
                              offset: const Offset(1, 1),
                              blurRadius: 1,
                            ),
                            BoxShadow(
                              color: Colors.white.withValues(alpha: 0.4),
                              offset: const Offset(-1, -1),
                              blurRadius: 1,
                            ),
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.4),
                              offset: const Offset(-1, -1),
                              blurRadius: 2, 
                            ),
                          ],
                          border: Border.all(
                            color: Colors.black.withValues(alpha: 0.1),
                            width: 0.5,
                          ),
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