import 'package:flutter/material.dart';

// 1. 전체 화면 (세로 방향 릴스 스크롤 담당)
class CardNewsScreen extends StatefulWidget {
  const CardNewsScreen({super.key});

  @override
  State<CardNewsScreen> createState() => _CardNewsScreenState();
}

class _CardNewsScreenState extends State<CardNewsScreen> {
  // 더미 데이터: 3개의 뉴스 주제, 각각 3장의 카드
  final List<List<Color>> _newsTopics = [
    [Colors.red.shade400, Colors.red.shade700, Colors.red.shade900],
    [Colors.blue.shade400, Colors.blue.shade700, Colors.blue.shade900],
    [Colors.green.shade400, Colors.green.shade700, Colors.green.shade900],
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF1E211A),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios, color: Colors.white),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: const Text('오늘의 AI 뉴스', style: TextStyle(color: Colors.white)),
      ),
      // 바깥쪽: 위아래로 내리는 릴스 스타일 (세로 방향)
      body: PageView.builder(
        scrollDirection: Axis.vertical,
        itemCount: _newsTopics.length,
        itemBuilder: (context, verticalIndex) {
          // 안쪽: 좌우로 넘기는 캐러셀 스타일 (가로 방향)
          return HorizontalCardSlider(
            topicIndex: verticalIndex,
            cards: _newsTopics[verticalIndex],
          );
        },
      ),
    );
  }
}

// 2. 개별 뉴스 화면 (가로 방향 스크롤 담당)
class HorizontalCardSlider extends StatelessWidget {
  final int topicIndex;
  final List<Color> cards;

  const HorizontalCardSlider({
    super.key,
    required this.topicIndex,
    required this.cards,
  });

  @override
  Widget build(BuildContext context) {
    return PageView.builder(
      scrollDirection: Axis.horizontal, // 좌우로 스크롤!
      itemCount: cards.length,
      // 카드가 화면에 꽉 차지 않고 살짝 여백이 보이도록 viewportFraction 설정
      controller: PageController(viewportFraction: 0.9),
      itemBuilder: (context, horizontalIndex) {
        return Container(
          margin: const EdgeInsets.symmetric(horizontal: 10.0, vertical: 20.0),
          decoration: BoxDecoration(
            color: cards[horizontalIndex],
            borderRadius: BorderRadius.circular(24),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.3),
                blurRadius: 10,
                offset: const Offset(0, 5),
              ),
            ],
          ),
          child: Center(
            child: Text(
              '뉴스 ${topicIndex + 1}\n카드 ${horizontalIndex + 1}',
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 32,
                color: Colors.white,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        );
      },
    );
  }
}
