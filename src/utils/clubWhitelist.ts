/**
 * 俱乐部白名单校验
 * 只允许白名单内的俱乐部成员使用本系统
 */

export const CLUB_WHITELIST: readonly number[] = [
  7763708, // 东方树叶
  7764758, // 东方树叶二
  7781009, // 东方树叶三
  7787035, // 树叶炸鱼团一
  7787038, // 树叶炸鱼团二
] as const;

export const CLUB_NAMES: Record<number, string> = {
  7763708: "东方树叶",
  7764758: "东方树叶二",
  7781009: "东方树叶三",
  7787035: "树叶炸鱼团一",
  7787038: "树叶炸鱼团二",
};

export const CLUB_DENY_MESSAGE = "加入东方树叶，做兄弟，在心中";

export const CLUB_AVATAR_PATH = "/icons/dongfangshuye.png";

export function isClubAllowed(legionId: number | undefined | null): boolean {
  if (!legionId) return false;
  return CLUB_WHITELIST.includes(legionId);
}
