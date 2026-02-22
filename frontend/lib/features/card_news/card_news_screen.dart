import 'package:flutter/material.dart';
import 'package:flutter_card_swiper/flutter_card_swiper.dart';

// 1. 전체 화면 (세로 방향의 릴스 스타일 PageView 담당)
class CardNewsScreen extends StatefulWidget {
  const CardNewsScreen({super.key});

  @override
  State<CardNewsScreen> createState() => _CardNewsScreenState();
}

class _CardNewsScreenState extends State<CardNewsScreen> {
  // 더미 데이터: 3개의 주제(세로 스크롤), 각각 3개의 카드(가로 스와이프)
  final List<List<Color>> _newsTopics = [
    [
      Colors.red.shade400,
      Colors.red.shade700,
      Colors.red.shade900,
    ], // 1번 뉴스 (빨강 계열)
    [
      Colors.blue.shade400,
      Colors.blue.shade700,
      Colors.blue.shade900,
    ], // 2번 뉴스 (파랑 계열)
    [
      Colors.green.shade400,
      Colors.green.shade700,
      Colors.green.shade900,
    ], // 3번 뉴스 (초록 계열)
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
      // 릴스처럼 위아래로 넘기는 세로 PageView
      body: PageView.builder(
        scrollDirection: Axis.vertical, // 세로 방향 스크롤!
        itemCount: _newsTopics.length,
        itemBuilder: (context, index) {
          // 각 페이지마다 독립된 카드 스와이퍼 위젯을 배치합니다.
          return TopicCardSwiper(topicIndex: index, cards: _newsTopics[index]);
        },
      ),
    );
  }
}

// 2. 개별 뉴스 주제 화면 (가로 방향의 틴더 스타일 스와이프 담당)
class TopicCardSwiper extends StatefulWidget {
  final int topicIndex;
  final List<Color> cards;

  const TopicCardSwiper({
    super.key,
    required this.topicIndex,
    required this.cards,
  });

  @override
  State<TopicCardSwiper> createState() => _TopicCardSwiperState();
}

class _TopicCardSwiperState extends State<TopicCardSwiper> {
  // 각 주제별로 스와이프 상태를 기억하기 위해 별도의 컨트롤러를 생성합니다.
  final CardSwiperController _swiperController = CardSwiperController();

  bool _onSwipe(
    int previousIndex,
    int? currentIndex,
    CardSwiperDirection direction,
  ) {
    if (direction == CardSwiperDirection.right) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            '${widget.topicIndex + 1}번째 뉴스의 ${previousIndex + 1}번 카드 저장됨! 💾',
          ),
          duration: const Duration(milliseconds: 800),
        ),
      );
    }
    return true;
  }

  @override
  void dispose() {
    _swiperController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Expanded(
          child: CardSwiper(
            controller: _swiperController,
            cardsCount: widget.cards.length,
            onSwipe: _onSwipe,
            // 좌우(가로) 스와이프만 허용하여 세로 스크롤(PageView)과 제스처 충돌을 방지합니다.
            allowedSwipeDirection: const AllowedSwipeDirection.symmetric(
              horizontal: true,
            ),
            numberOfCardsDisplayed: widget.cards.length > 2
                ? 3
                : widget.cards.length,
            backCardOffset: const Offset(0, 40),
            padding: const EdgeInsets.symmetric(
              horizontal: 24.0,
              vertical: 10.0,
            ),
            cardBuilder: (context, index, x, y) {
              return Container(
                decoration: BoxDecoration(
                  color: widget.cards[index],
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
                    '뉴스 ${widget.topicIndex + 1}\n카드 ${index + 1}',
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
          ),
        ),
        // 되돌리기 버튼
        Padding(
          padding: const EdgeInsets.only(bottom: 40, top: 10),
          child: IconButton(
            iconSize: 40,
            icon: const Icon(Icons.refresh, color: Colors.white70),
            onPressed: _swiperController.undo,
          ),
        ),
      ],
    );
  }
}
