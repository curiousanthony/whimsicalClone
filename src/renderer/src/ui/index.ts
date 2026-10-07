/**
 * Shared presentational primitives (owner: shell/ui). Editor modules may import from here.
 * Styled with the --wc-* design tokens only.
 */

import './ui.css';

export { Icon, getLucideIcon, type IconProps } from './Icon';
export { Button, IconButton, type ButtonProps, type IconButtonProps } from './Button';
export { Tooltip, type TooltipProps } from './Tooltip';
export { Kbd } from './Kbd';
export { Menu, useMenuState, type MenuAnchor, type MenuEntry, type MenuProps } from './Menu';
export { Modal, type ModalProps } from './Modal';
export { SegmentedControl, Select, Switch, TextField, type SegmentedOption, type TextFieldProps } from './controls';
export { FileIcon, fileKindColor, fileKindIcon, type FileIconProps } from './FileIcon';
