export type AvatarPreset = {
  id: string;
  emoji: string;
  labelKey: string;
};

const AVATAR_PRESET_PREFIX = 'preset:';

export const AVATAR_PRESETS: AvatarPreset[] = [
  { id: 'running-man', emoji: '🏃‍♂️', labelKey: 'profile.avatarPresetRunningMan' },
  { id: 'running-woman', emoji: '🏃‍♀️', labelKey: 'profile.avatarPresetRunningWoman' },
  { id: 'trail-runner-man', emoji: '🏔️', labelKey: 'profile.avatarPresetTrailRunnerMan' },
  { id: 'trail-runner-woman', emoji: '🧗‍♀️', labelKey: 'profile.avatarPresetTrailRunnerWoman' },
  { id: 'hiker', emoji: '🥾', labelKey: 'profile.avatarPresetHiker' },
  { id: 'biker', emoji: '🚴', labelKey: 'profile.avatarPresetBiker' },
];

export function toAvatarPresetValue(presetId: string): string {
  return `${AVATAR_PRESET_PREFIX}${presetId}`;
}

export function getAvatarPreset(avatarValue?: string | null): AvatarPreset | undefined {
  if (!avatarValue?.startsWith(AVATAR_PRESET_PREFIX)) {
    return undefined;
  }

  const presetId = avatarValue.slice(AVATAR_PRESET_PREFIX.length);
  return AVATAR_PRESETS.find(preset => preset.id === presetId);
}

export function getAvatarImageSrc(avatarValue?: string | null): string | undefined {
  if (!avatarValue || getAvatarPreset(avatarValue)) {
    return undefined;
  }
  return avatarValue;
}

export function getAvatarFallbackText(avatarValue: string | undefined, fallbackText: string): string {
  const preset = getAvatarPreset(avatarValue);
  return preset?.emoji ?? fallbackText;
}
