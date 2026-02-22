import 'package:flutter/material.dart';

class CardNewsScreen extends StatelessWidget {
  const CardNewsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios, color: Colors.white),
          onPressed: () => Navigator.of(context).pop(), // 뒤로 가기
        ),
        title: const Text('카드뉴스 (더미)', style: TextStyle(color: Colors.white)),
      ),
      body: Center(
        // 나중에 이 부분을 틴더 스와이프 카드로 교체할 예정입니다.
        child: Container(
          width: 300,
          height: 450,
          decoration: BoxDecoration(
            color: Colors.red, // 더미 색상
            borderRadius: BorderRadius.circular(24),
          ),
          child: const Center(
            child: Text(
              '첫 번째 카드',
              style: TextStyle(
                fontSize: 32,
                color: Colors.white,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
