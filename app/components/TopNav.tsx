'use client';

import { 
  LayoutDashboard, 
  ListEnd, 
  Briefcase, 
  Target, 
  LineChart, 
  Heart, 
  Bot, 
  User,
  Zap
} from 'lucide-react';
import Link from 'next/link';

const navLinks = [
  { name: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" />, href: '/' },
  { name: 'Saisie & Histo', icon: <ListEnd className="w-4 h-4" />, href: '/saisie' },
  { name: 'Portfolio & Épargne', icon: <Briefcase className="w-4 h-4" />, href: '#' },
  { name: 'Objectifs', icon: <Target className="w-4 h-4" />, href: '#' },
  { name: 'Analyse & Trends', icon: <LineChart className="w-4 h-4" />, href: '#' },
  { name: 'Santé', icon: <Heart className="w-4 h-4" />, href: '#' },
  { name: 'Coach IA', icon: <Bot className="w-4 h-4" />, href: '#' },
  { name: 'Profil', icon: <User className="w-4 h-4" />, href: '#' },
];

export default function TopNav() {
  return (
    <nav className="bg-[#131b2c] border-b border-slate-800 text-slate-300 sticky top-0 z-[60]">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-blue-600 p-1.5 rounded-lg shadow-lg shadow-blue-900/20">
            <Zap className="w-5 h-5 text-white fill-current" />
          </div>
          <span className="font-black tracking-tighter text-lg text-white">Wealth OS</span>
        </div>

        <div className="hidden lg:flex items-center gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.name}
              href={link.href}
              className="flex items-center gap-2 px-3 py-2 rounded-md hover:text-blue-400 hover:bg-slate-800 transition-all text-[13px] font-medium"
            >
              {link.icon}
              {link.name}
            </Link>
          ))}
        </div>

        <div className="lg:hidden p-2 text-slate-400 hover:text-white cursor-pointer">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </div>
      </div>
    </nav>
  );
}
