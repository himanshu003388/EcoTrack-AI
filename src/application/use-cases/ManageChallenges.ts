import { IChallengeRepository, JoinedUserChallenge } from '../../domain/repositories/IChallengeRepository';
import { IUserRepository } from '../../domain/repositories/IUserRepository';
import { Challenge, UserChallenge } from '../../domain/entities/Challenge';
import { calculateLevel } from '../../domain/level';
import { clearDashboardCache } from './GetDashboardData';
import { clearReportCache } from './GenerateReport';

export class ManageChallenges {
  constructor(
    private challengeRepository: IChallengeRepository,
    private userRepository: IUserRepository
  ) {}

  /**
   * Lists all available challenges in the system alongside the challenges the user has joined.
   *
   * @param userId - The ID of the user.
   * @returns A Promise resolving to an object with lists of all challenges and the user's joined challenges.
   */
  async listAll(userId: number): Promise<{ challenges: Challenge[]; joined: JoinedUserChallenge[] }> {
    const [challenges, joined] = await Promise.all([
      this.challengeRepository.listAll(),
      this.challengeRepository.getUserChallenges(userId)
    ]);
    return { challenges, joined };
  }

  /**
   * Enrolls a user in a specific carbon-saving challenge.
   *
   * @param userId - The ID of the user.
   * @param challengeId - The ID of the challenge to join.
   * @returns A Promise resolving to the created/returned UserChallenge record.
   * @throws Error if the challenge is not found.
   */
  async join(userId: number, challengeId: number): Promise<UserChallenge> {
    const challenge = await this.challengeRepository.findById(challengeId);
    if (!challenge) throw new Error('Challenge not found.');

    const res = await this.challengeRepository.joinChallenge(userId, challengeId);
    clearDashboardCache(userId);
    clearReportCache(userId);
    return res;
  }

  /**
   * Marks a joined challenge as completed for a user, updating progress and awarding reward points.
   *
   * @param userId - The ID of the user.
   * @param challengeId - The ID of the challenge to complete.
   * @returns A Promise resolving to the updated UserChallenge record.
   * @throws Error if the user has not joined the challenge or the challenge does not exist.
   */
  async complete(userId: number, challengeId: number): Promise<UserChallenge> {
    const [joined, challenge, user] = await Promise.all([
      this.challengeRepository.getUserChallenge(userId, challengeId),
      this.challengeRepository.findById(challengeId),
      this.userRepository.findById(userId)
    ]);

    if (!joined) throw new Error('You have not joined this challenge.');
    if (joined.status === 'completed') return joined;
    if (!challenge) throw new Error('Challenge not found.');

    // 1. Mark challenge as completed
    const updatedChallenge = await this.challengeRepository.updateChallengeProgress(
      userId,
      challengeId,
      challenge.durationDays,
      'completed'
    );

    // 2. Award Points & update Level
    if (user) {
      const totalPoints = user.points + challenge.pointsReward;
      const newLevel = calculateLevel(totalPoints);
      await this.userRepository.updatePointsAndLevel(userId, totalPoints, newLevel);
    }

    clearDashboardCache(userId);
    clearReportCache(userId);

    return updatedChallenge;
  }


}
