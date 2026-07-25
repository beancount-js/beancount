import { DropdownMenu as DropdownMenuPrimitive } from "bits-ui";
import CheckboxItem from "./dropdown-menu-checkbox-item.svelte";
import Content from "./dropdown-menu-content.svelte";
import Item from "./dropdown-menu-item.svelte";
import Label from "./dropdown-menu-label.svelte";
import RadioGroup from "./dropdown-menu-radio-group.svelte";
import RadioItem from "./dropdown-menu-radio-item.svelte";
import Separator from "./dropdown-menu-separator.svelte";
import Shortcut from "./dropdown-menu-shortcut.svelte";
import SubContent from "./dropdown-menu-sub-content.svelte";
import SubTrigger from "./dropdown-menu-sub-trigger.svelte";

const Root = DropdownMenuPrimitive.Root;
const Trigger = DropdownMenuPrimitive.Trigger;
const Group = DropdownMenuPrimitive.Group;
const Sub = DropdownMenuPrimitive.Sub;
const Portal = DropdownMenuPrimitive.Portal;

export {
  Root,
  Content,
  Item,
  Label,
  Group,
  Trigger,
  Shortcut,
  Separator,
  RadioGroup,
  RadioItem,
  Sub,
  SubContent,
  SubTrigger,
  CheckboxItem,
  Portal,
  //
  Root as DropdownMenu,
  Content as DropdownMenuContent,
  Item as DropdownMenuItem,
  Label as DropdownMenuLabel,
  Group as DropdownMenuGroup,
  Trigger as DropdownMenuTrigger,
  Shortcut as DropdownMenuShortcut,
  Separator as DropdownMenuSeparator,
  RadioGroup as DropdownMenuRadioGroup,
  RadioItem as DropdownMenuRadioItem,
  Sub as DropdownMenuSub,
  SubContent as DropdownMenuSubContent,
  SubTrigger as DropdownMenuSubTrigger,
  CheckboxItem as DropdownMenuCheckboxItem,
  Portal as DropdownMenuPortal,
};

export {
  dropdown_menuTokenNames,
  type DropdownMenuToken,
} from "./dropdown-menu.tokens.js";
