import 'dart:math' as math;

import 'package:flutter/material.dart';

class ClickWheel extends StatefulWidget {
  final VoidCallback onCenterTap;
  final VoidCallback onScrollRight;
  final VoidCallback onScrollLeft;
  final bool isPlaying;

  const ClickWheel({
    super.key,
    required this.onCenterTap,
    required this.onScrollRight,
    required this.onScrollLeft,
    this.isPlaying = false,
  });

  @override
  State<ClickWheel> createState() => _ClickWheelState();
}

class _ClickWheelState extends State<ClickWheel> {
  static const double _wheelSize = 220;
  static const double _centerButtonSize = 88;

  double _lastAngle = 0.0;
  double _accumulatedAngle = 0.0;
  double _visualRotation = 0.0;
  bool _isDragging = false;

  final double _scrollThreshold = 0.5;

  void _onPanStart(DragStartDetails details) {
    _lastAngle = _calculateAngle(details.localPosition);
    setState(() => _isDragging = true);
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

  void _onPanEnd(DragEndDetails details) {
    setState(() {
      _isDragging = false;
      _visualRotation = 0.0;
      _accumulatedAngle = 0.0;
    });
  }

  void _onPanCancel() {
    setState(() {
      _isDragging = false;
      _visualRotation = 0.0;
      _accumulatedAngle = 0.0;
    });
  }

  double _calculateAngle(Offset localPosition) {
    const Offset center = Offset(_wheelSize / 2, _wheelSize / 2);
    return math.atan2(
      localPosition.dy - center.dy,
      localPosition.dx - center.dx,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      height: _wheelSize,
      alignment: Alignment.center,
      child: GestureDetector(
        onPanStart: _onPanStart,
        onPanUpdate: _onPanUpdate,
        onPanEnd: _onPanEnd,
        onPanCancel: _onPanCancel,
        child: Container(
          width: _wheelSize,
          height: _wheelSize,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: const RadialGradient(
              center: Alignment(-0.28, -0.32),
              radius: 0.95,
              colors: [
                Color(0xFFF8F8F5),
                Color(0xFFE8E8E2),
                Color(0xFFCFCFC8),
              ],
              stops: [0.0, 0.62, 1.0],
            ),
            border: Border.all(
              color: Colors.white.withValues(alpha: 0.55),
              width: 1.2,
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.26),
                blurRadius: 22,
                offset: const Offset(0, 12),
              ),
              BoxShadow(
                color: Colors.white.withValues(alpha: 0.16),
                blurRadius: 8,
                offset: const Offset(-4, -5),
              ),
            ],
          ),
          child: Stack(
            alignment: Alignment.center,
            children: [
              AnimatedRotation(
                turns: _visualRotation / (2 * math.pi),
                duration: _isDragging
                    ? Duration.zero
                    : const Duration(milliseconds: 280),
                curve: Curves.easeOutCubic,
                child: Align(
                  alignment: Alignment.topCenter,
                  child: Padding(
                    padding: const EdgeInsets.only(top: 18),
                    child: IgnorePointer(
                      child: Container(
                        width: 18,
                        height: 18,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: const Color(0xFFD7D7D1),
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
                  width: _centerButtonSize,
                  height: _centerButtonSize,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: const LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [
                        Color(0xFFF9F9F6),
                        Color(0xFFD5D5CE),
                      ],
                    ),
                    border: Border.all(
                      color: Colors.black.withValues(alpha: 0.07),
                      width: 1,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.22),
                        blurRadius: 9,
                        offset: const Offset(2, 4),
                      ),
                      BoxShadow(
                        color: Colors.white.withValues(alpha: 0.8),
                        blurRadius: 5,
                        offset: const Offset(-2, -3),
                      ),
                    ],
                  ),
                  child: Icon(
                    widget.isPlaying
                        ? Icons.pause_rounded
                        : Icons.play_arrow_rounded,
                    color: const Color(0xFF7F8078),
                    size: 38,
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
