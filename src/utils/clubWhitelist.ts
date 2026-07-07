/**
 * 俱乐部白名单校验
 * 优先从 /clubWhitelist.json 加载配置，加载失败时使用硬编码 fallback
 */

// ==================== 硬编码 Fallback ====================

const FALLBACK_WHITELIST: number[] = [
  7763708, // 东方树叶
  7764758, // 东方树叶二
  7781009, // 东方树叶三
  7787035, // 树叶炸鱼团一
  7787038, // 树叶炸鱼团二
];

const FALLBACK_NAMES: Record<number, string> = {
  7763708: "东方树叶",
  7764758: "东方树叶二",
  7781009: "东方树叶三",
  7787035: "树叶炸鱼团一",
  7787038: "树叶炸鱼团二",
};

const FALLBACK_DENY_MESSAGE = "加入东方树叶，做兄弟，在心中";
const FALLBACK_AVATAR_PATH = "/icons/dongfangshuye.png";

// ==================== 运行时状态（可被远端配置覆盖）====================

let clubWhitelist: number[] = [...FALLBACK_WHITELIST];
let clubNames: Record<number, string> = { ...FALLBACK_NAMES };
export let CLUB_DENY_MESSAGE: string = FALLBACK_DENY_MESSAGE;
export let CLUB_AVATAR_PATH: string = FALLBACK_AVATAR_PATH;
let loaded = false;

// ==================== 核心校验 ====================

export function isClubAllowed(legionId: number | undefined | null): boolean {
  if (!legionId) return false;
  return clubWhitelist.includes(legionId);
}

export function getClubName(legionId: number): string | undefined {
  return clubNames[legionId];
}

// ==================== 远端加载 ====================

export async function loadClubWhitelist(
  url: string = "/clubWhitelist.json",
): Promise<boolean> {
  if (loaded) return true;
  try {
    const response = await fetch(url, { cache: "no-cache" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();

    if (Array.isArray(data.whitelist) && data.whitelist.length > 0) {
      clubWhitelist = data.whitelist.map((item: any) =>
        typeof item === "number" ? item : Number(item.id),
      );
      clubNames = {};
      data.whitelist.forEach((item: any) => {
        if (item.id && item.name) {
          clubNames[Number(item.id)] = item.name;
        }
      });
    }

    if (data.denyMessage) CLUB_DENY_MESSAGE = data.denyMessage;
    if (data.avatarPath) CLUB_AVATAR_PATH = data.avatarPath;

    loaded = true;
    console.log(
      `[ClubWhitelist] 远端配置加载成功，共 ${clubWhitelist.length} 个俱乐部`,
    );
    return true;
  } catch (error) {
    console.warn(
      "[ClubWhitelist] 远端配置加载失败，使用硬编码 fallback:",
      error,
    );
    loaded = true;
    return false;
  }
}
