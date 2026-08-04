import 'dart:math' as math;

import 'package:flutter/material.dart';

class ClickWheel extends StatefulWidget {
  static const double defaultSize = 220;

  final VoidCallback onCenterTap;
  final VoidCallback onScrollRight;
  final VoidCallback onScrollLeft;
  final bool isPlaying;
  final double size;

  const ClickWheel({
    super.key,
    required this.onCenterTap,
    required this.onScrollRight,
    required this.onScrollLeft,
    this.isPlaying = false,
    this.size = defaultSize,
  });

  @override
  State<ClickWheel> createState() => _ClickWheelState();
}

class _ClickWheelState extends State<ClickWheel> {
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
    final center = Offset(widget.size / 2, widget.size / 2);
    return math.atan2(
      localPosition.dy - center.dy,
      localPosition.dx - center.dx,
    );
  }

  @override
  Widget build(BuildContext context) {
    final scale = widget.size / ClickWheel.defaultSize;
    final centerButtonSize = _centerButtonSize * scale;

    return Container(
      width: double.infinity,
      height: widget.size,
      alignment: Alignment.center,
      child: GestureDetector(
        onPanStart: _onPanStart,
        onPanUpdate: _onPanUpdate,
        onPanEnd: _onPanEnd,
        onPanCancel: _onPanCancel,
        child: Container(
          width: widget.size,
          height: widget.size,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: const RadialGradient(
              center: Alignment(-0.28, -0.32),
              radius: 0.95,
              colors: [Color(0xFFF8F8F5), Color(0xFFE8E8E2), Color(0xFFCFCFC8)],
              stops: [0.0, 0.62, 1.0],
            ),
            border: Border.all(
              color: Colors.white.withValues(alpha: 0.55),
              width: 1.2,
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.26),
                blurRadius: 22 * scale,
                offset: Offset(0, 12 * scale),
              ),
              BoxShadow(
                color: Colors.white.withValues(alpha: 0.16),
                blurRadius: 8 * scale,
                offset: Offset(-4 * scale, -5 * scale),
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
                    padding: EdgeInsets.only(top: 18 * scale),
                    child: IgnorePointer(
                      child: Container(
                        width: 18 * scale,
                        height: 18 * scale,
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
                  width: centerButtonSize,
                  height: centerButtonSize,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: const Color(0xFF50583D),
                    gradient: const LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [
                        Color(0xFF3F4732),
                        Color(0xFF566044),
                        Color(0xFF687250),
                      ],
                      stops: [0.0, 0.58, 1.0],
                    ),
                    border: Border.all(
                      color: Colors.black.withValues(alpha: 0.2),
                      width: 1,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.38),
                        blurRadius: 8,
                        offset: const Offset(-3, -3),
                      ),
                      BoxShadow(
                        color: Colors.white.withValues(alpha: 0.35),
                        blurRadius: 7,
                        offset: const Offset(3, 4),
                      ),
                    ],
                  ),
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      Positioned.fill(
                        child: DecoratedBox(
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            gradient: RadialGradient(
                              center: const Alignment(-0.34, -0.34),
                              radius: 0.82,
                              colors: [
                                Colors.black.withValues(alpha: 0.24),
                                Colors.transparent,
                              ],
                              stops: const [0.0, 0.72],
                            ),
                          ),
                        ),
                      ),
                      Positioned.fill(
                        child: Padding(
                          padding: EdgeInsets.all(4 * scale),
                          child: DecoratedBox(
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              border: Border.all(
                                color: Colors.black.withValues(alpha: 0.2),
                                width: 1.5,
                              ),
                            ),
                          ),
                        ),
                      ),
                      Positioned.fill(
                        child: Padding(
                          padding: EdgeInsets.all(6 * scale),
                          child: DecoratedBox(
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              gradient: LinearGradient(
                                begin: Alignment.topLeft,
                                end: Alignment.bottomRight,
                                colors: [
                                  Colors.black.withValues(alpha: 0.2),
                                  Colors.transparent,
                                  Colors.white.withValues(alpha: 0.16),
                                ],
                                stops: const [0.0, 0.55, 1.0],
                              ),
                            ),
                          ),
                        ),
                      ),
                      Icon(
                        widget.isPlaying
                            ? Icons.pause_rounded
                            : Icons.play_arrow_rounded,
                        color: Colors.white,
                        size: 38 * scale,
                      ),
                    ],
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
