class UserProfile {
  final String userId;
  final String email;
  final String nickname;
  final String? profileImageUrl;
  final String provider;
  final String role;
  final bool isActive;
  final String timezone;
  final DateTime? lastLoginAt;
  final DateTime createdAt;
  final DateTime updatedAt;

  const UserProfile({
    required this.userId,
    required this.email,
    required this.nickname,
    this.profileImageUrl,
    required this.provider,
    required this.role,
    required this.isActive,
    required this.timezone,
    this.lastLoginAt,
    required this.createdAt,
    required this.updatedAt,
  });

  factory UserProfile.fromJson(Map<String, dynamic> json) {
    return UserProfile(
      userId: json['userId'] as String,
      email: json['email'] as String,
      nickname: json['nickname'] as String,
      profileImageUrl: json['profileImageUrl'] as String?,
      provider: json['provider'] as String,
      role: json['role'] as String,
      isActive: json['isActive'] as bool,
      timezone: json['timezone'] as String,
      lastLoginAt: json['lastLoginAt'] != null
          ? DateTime.tryParse(json['lastLoginAt'] as String)
          : null,
      createdAt: DateTime.parse(json['createdAt'] as String),
      updatedAt: DateTime.parse(json['updatedAt'] as String),
    );
  }
}
