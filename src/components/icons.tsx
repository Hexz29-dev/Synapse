import {
  AddLinear,
  ArrowDown2Linear,
  ArrowLeftLinear,
  ArrowRightLinear,
  Book1Linear,
  Chart2Linear,
  CheckLinear,
  CopyLinear,
  DangerLinear,
  Edit2Linear,
  EyeLinear,
  EyeSlashLinear,
  FlashLinear,
  FolderLinear,
  Import2Linear,
  InfoCircleLinear,
  KeyboardLinear,
  LayerLinear,
  LockLinear,
  LogoutLinear,
  MoreLinear,
  MoonLinear,
  RefreshLinear,
  SearchNormal1Linear,
  SmsLinear,
  SunLinear,
  TickCircleLinear,
  TrashLinear,
  type IconProps,
} from 'mx-icons';
import type { FC } from 'react';

type Props = Omit<IconProps, 'color'> & { size?: number };

/** Envolve um ícone do mx-icons para herdar a cor do texto (currentColor). */
const wrap = (C: FC<IconProps>): FC<Props> => {
  const Wrapped: FC<Props> = ({ size = 18, ...rest }) => (
    <C size={size} color="currentColor" aria-hidden="true" focusable="false" {...rest} />
  );
  return Wrapped;
};

export const Icon = {
  Add: wrap(AddLinear),
  Chevron: wrap(ArrowDown2Linear),
  ArrowLeft: wrap(ArrowLeftLinear),
  ArrowRight: wrap(ArrowRightLinear),
  Study: wrap(Book1Linear),
  Stats: wrap(Chart2Linear),
  Check: wrap(CheckLinear),
  Copy: wrap(CopyLinear),
  Danger: wrap(DangerLinear),
  Download: wrap(Import2Linear),
  Edit: wrap(Edit2Linear),
  Eye: wrap(EyeLinear),
  EyeOff: wrap(EyeSlashLinear),
  Streak: wrap(FlashLinear),
  Folder: wrap(FolderLinear),
  Info: wrap(InfoCircleLinear),
  Keyboard: wrap(KeyboardLinear),
  Decks: wrap(LayerLinear),
  Lock: wrap(LockLinear),
  Logout: wrap(LogoutLinear),
  More: wrap(MoreLinear),
  Refresh: wrap(RefreshLinear),
  Search: wrap(SearchNormal1Linear),
  Mail: wrap(SmsLinear),
  Sun: wrap(SunLinear),
  Moon: wrap(MoonLinear),
  Success: wrap(TickCircleLinear),
  Trash: wrap(TrashLinear),
};

