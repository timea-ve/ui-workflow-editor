// Curated lucide icon set (ISC licence) for the Icon / Icon button components and the context-bar icon picker.
// Explicit imports keep the bundle small; add names here to offer more icons.
import {
  AlertCircle, ArrowLeft, ArrowRight, Bell, Bookmark, Calendar, Camera, Check, ChevronDown, ChevronLeft, ChevronRight,
  ChevronUp, Circle, Clock, Cloud, Copy, CreditCard, Download, Edit, Eye, File, Filter, Flag, Folder, Gift, Globe, Grid,
  Heart, HelpCircle, Home, Image, Info, Link, List, Lock, LogOut, Mail, Map, MapPin, Menu, MessageCircle, Mic, Minus,
  MoreHorizontal, MoreVertical, Music, Phone, Play, Plus, Search, Send, Settings, Share2, ShoppingBag, ShoppingCart, Sliders,
  Square, Star, Sun, Tag, ThumbsUp, Trash2, Upload, User, Users, Video, Wifi, X, Zap, type LucideIcon,
} from 'lucide-react';

export const KIT_ICONS: Record<string, LucideIcon> = {
  'alert': AlertCircle, 'arrow-left': ArrowLeft, 'arrow-right': ArrowRight, 'bell': Bell, 'bookmark': Bookmark,
  'calendar': Calendar, 'camera': Camera, 'check': Check, 'chevron-down': ChevronDown, 'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight, 'chevron-up': ChevronUp, 'circle': Circle, 'clock': Clock, 'cloud': Cloud, 'copy': Copy,
  'credit-card': CreditCard, 'download': Download, 'edit': Edit, 'eye': Eye, 'file': File, 'filter': Filter, 'flag': Flag,
  'folder': Folder, 'gift': Gift, 'globe': Globe, 'grid': Grid, 'heart': Heart, 'help': HelpCircle, 'home': Home,
  'image': Image, 'info': Info, 'link': Link, 'list': List, 'lock': Lock, 'log-out': LogOut, 'mail': Mail, 'map': Map,
  'map-pin': MapPin, 'menu': Menu, 'message': MessageCircle, 'mic': Mic, 'minus': Minus, 'more': MoreHorizontal,
  'more-vertical': MoreVertical, 'music': Music, 'phone': Phone, 'play': Play, 'plus': Plus, 'search': Search, 'send': Send,
  'settings': Settings, 'share': Share2, 'shopping-bag': ShoppingBag, 'cart': ShoppingCart, 'sliders': Sliders,
  'square': Square, 'star': Star, 'sun': Sun, 'tag': Tag, 'thumbs-up': ThumbsUp, 'trash': Trash2, 'upload': Upload,
  'user': User, 'users': Users, 'video': Video, 'wifi': Wifi, 'close': X, 'zap': Zap,
};

export const KIT_ICON_NAMES = Object.keys(KIT_ICONS);

/** Draws a kit icon in the current ink colour; unknown names fall back to a circle. */
export function KitIcon({ name, size = 20, strokeWidth = 1.75 }: { name: string; size?: number; strokeWidth?: number }) {
  const Icon = KIT_ICONS[name] ?? Circle;
  return <Icon size={size} strokeWidth={strokeWidth} aria-hidden color="currentColor" />;
}
