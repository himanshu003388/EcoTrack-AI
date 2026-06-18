import { IChallengeRepository, JoinedUserChallenge } from '../../domain/repositories/IChallengeRepository';
import { IUserRepository } from '../../domain/repositories/IUserRepository';
import { Challenge, UserChallenge } from '../../domain/entities/Challenge';
import { calculateLevel } from '../../domain/level';

export class ManageChallenges {
  constructor(
    private challengeRepository: IChallengeRepository,
    private userRepository: IUserRepository
  ) {}

  async listAll(userId: number): Promise<{ challenges: Challenge[]; joined: JoinedUserChallenge[] }> {
    const challenges = await this.challengeRepository.listAll();
    const joined = await this.challengeRepository.getUserChallenges(userId);
    return { challenges, joined };
  }

  async join(userId: number, challengeId: number): Promise<UserChallenge> {
    const challenge = await this.challengeRepository.findById(challengeId);
    if (!challenge) throw new Error('Challenge not found.');

    return await this.challengeRepository.joinChallenge(userId, challengeId);
  }

  async complete(userId: number, challengeId: number): Promise<UserChallenge> {
    const joined = await this.challengeRepository.getUserChallenge(userId, challengeId);
    if (!joined) throw new Error('You have not joined this challenge.');
    if (joined.status === 'completed') return joined;

    const challenge = await this.challengeRepository.findById(challengeId);
    if (!challenge) throw new Error('Challenge not found.');

    // 1. Mark challenge as completed
    const updatedChallenge = await this.challengeRepository.updateChallengeProgress(
      userId,
      challengeId,
      challenge.durationDays,
      'completed'
    );

    // 2. Award Points & update Level
    const user = await this.userRepository.findById(userId);
    if (user) {
      const totalPoints = user.points + challenge.pointsReward;
      const newLevel = calculateLevel(totalPoints);
      await this.userRepository.updatePointsAndLevel(userId, totalPoints, newLevel);
    }

    return updatedChallenge;
  }


}
