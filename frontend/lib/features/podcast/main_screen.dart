import 'package:flutter/material.dart';
import '../../shared/widgets/click_wheel.dart';
import '../card_news/card_news_screen.dart';

class MainScreen extends StatefulWidget {
  const MainScreen({super.key});

  @override
  State<MainScreen> createState() => _MainScreenState();
}

class _MainScreenState extends State<MainScreen> {
  void _goToCardNews() {
    Navigator.of(context).push(
      PageRouteBuilder(
        pageBuilder: (context, animation, secondaryAnimation) =>
            const CardNewsScreen(),
        transitionsBuilder: (context, animation, secondaryAnimation, child) {
          // 오른쪽에서 왼쪽으로 스르륵 나타나는 애니메이션
          const begin = Offset(1.0, 0.0);
          const end = Offset.zero;
          const curve = Curves.easeInOut;
          var tween = Tween(
            begin: begin,
            end: end,
          ).chain(CurveTween(curve: curve));
          var offsetAnimation = animation.drive(tween);

          return SlideTransition(position: offsetAnimation, child: child);
        },
      ),
    );
  }

  // PageView를 제어하기 위한 컨트롤러
  final PageController _pageController = PageController(viewportFraction: 0.85);

  // 더미 데이터 (빨강, 파랑, 노랑)
  final List<Color> _dummyColors = [Colors.red, Colors.blue, Colors.yellow];

  // 다음 팟캐스트로 부드럽게 넘어가기
  void _nextPodcast() {
    _pageController.nextPage(
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeInOut,
    );
  }

  // 이전 팟캐스트로 부드럽게 넘어가기
  void _previousPodcast() {
    _pageController.previousPage(
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeInOut,
    );
  }

  // 가운데 버튼 클릭 시 상세 화면으로 이동
  void _enterPodcast() {
    int currentIndex = _pageController.page?.round() ?? 0;

    // TODO: 임시로 SnackBar 띄우기. 나중에 실제 플레이어 화면으로 이동시킬 예정입니다.
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('${currentIndex + 1}번째 팟캐스트로 들어갑니다!')),
    );
  }

  @override
  void dispose() {
    _pageController.dispose(); // 메모리 누수 방지
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            const SizedBox(height: 20),
            // 상단: 팟캐스트 커버 영역 (PageView)
            Expanded(
              child: PageView.builder(
                controller: _pageController,
                itemCount: _dummyColors.length,
                itemBuilder: (context, index) {
                  return Container(
                    margin: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 20,
                    ),
                    decoration: BoxDecoration(
                      color: _dummyColors[index],
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
                        'Podcast ${index + 1}',
                        style: const TextStyle(
                          fontSize: 32,
                          fontWeight: FontWeight.bold,
                          color: Colors.white,
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),

            // 하단: 우리가 만든 다이얼(Click Wheel)
            Padding(
              padding: const EdgeInsets.only(bottom: 60, top: 40),
              child: ClickWheel(
                onScrollRight: _nextPodcast,
                onScrollLeft: _previousPodcast,
                onCenterTap: _enterPodcast,
                onSwipeLeft: _goToCardNews,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
