/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, 
  Target, 
  Terminal, 
  ShieldCheck, 
  MessageSquare, 
  ExternalLink, 
  Plus, 
  Search, 
  Copy, 
  Check, 
  AlertCircle,
  Bug,
  Code2,
  Zap,
  Menu,
  X,
  ChevronRight,
  Send,
  Github,
  Settings,
  FileUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
import ReactMarkdown from 'react-markdown';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// --- Utilities ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---
type View = 'dashboard' | 'targets' | 'payloads' | 'checklist' | 'ailab' | 'settings';

interface TargetProgram {
  id: string;
  name: string;
  platform: 'HackerOne' | 'Bugcrowd' | 'Intigriti' | 'Private';
  reward: string;
  status: 'Active' | 'Paused' | 'Closed';
  url: string;
}

interface Payload {
  id: string;
  category: string;
  name: string;
  content: string;
  description: string;
}

interface ChecklistItem {
  id: string;
  category: string;
  task: string;
  completed: boolean;
}

// --- Constants ---
const INITIAL_TARGETS: TargetProgram[] = [
  { id: '1', name: 'Google VRP', platform: 'Private', reward: '$100 - $31,337', status: 'Active', url: 'https://bughunters.google.com/' },
  { id: '2', name: 'Meta Bug Bounty', platform: 'Private', reward: '$500 - $50,000+', status: 'Active', url: 'https://www.facebook.com/whitehat' },
  { id: '3', name: 'Airbnb', platform: 'HackerOne', reward: '$100 - $15,000', status: 'Active', url: 'https://hackerone.com/airbnb' },
];

const PAYLOADS: Payload[] = [
  { id: 'xss-1', category: 'XSS', name: 'Basic Alert', content: '<script>alert(1)</script>', description: 'Simple alert box for testing reflected XSS.' },
  { id: 'xss-2', category: 'XSS', name: 'Image Error', content: '<img src=x onerror=alert(1)>', description: 'Bypasses some simple filters that look for script tags.' },
  { id: 'sqli-1', category: 'SQLi', name: 'Auth Bypass', content: "' OR '1'='1", description: 'Classic authentication bypass payload.' },
  { id: 'sqli-2', category: 'SQLi', name: 'Union Select', content: "' UNION SELECT 1,2,3--", description: 'Used to extract data from other tables.' },
  { id: 'ssrf-1', category: 'SSRF', name: 'AWS Metadata', content: 'http://169.254.169.254/latest/meta-data/', description: 'Attempt to access AWS instance metadata.' },
  { id: 'lfi-1', category: 'LFI', name: 'Etc/Passwd', content: '../../../../etc/passwd', description: 'Classic local file inclusion test for Linux systems.' },
];

const CHECKLIST: ChecklistItem[] = [
  { id: 'c1', category: 'Recon', task: 'Subdomain enumeration', completed: false },
  { id: 'c2', category: 'Recon', task: 'Port scanning (Nmap)', completed: false },
  { id: 'c3', category: 'Auth', task: 'Test for weak password policies', completed: false },
  { id: 'c4', category: 'Auth', task: 'Check for session fixation', completed: false },
  { id: 'c5', category: 'Injection', task: 'Test all inputs for XSS', completed: false },
  { id: 'c6', category: 'Injection', task: 'Test for SQL Injection in search fields', completed: false },
];

// --- Components ---

const SidebarItem = ({ 
  icon: Icon, 
  label, 
  active, 
  onClick 
}: { 
  icon: any, 
  label: string, 
  active: boolean, 
  onClick: () => void 
}) => (
  <button
    onClick={onClick}
    className={cn(
      "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group",
      active 
        ? "bg-accent/10 text-accent border-r-2 border-accent" 
        : "text-text-muted hover:bg-white/5 hover:text-white"
    )}
  >
    <Icon size={20} className={cn(active ? "text-accent" : "group-hover:text-white")} />
    <span className="font-medium text-sm">{label}</span>
  </button>
);

const StatCard = ({ label, value, icon: Icon, trend }: { label: string, value: string, icon: any, trend?: string }) => (
  <div className="glass-card p-5 flex flex-col gap-2">
    <div className="flex justify-between items-start">
      <div className="p-2 bg-accent/10 rounded-lg text-accent">
        <Icon size={20} />
      </div>
      {trend && <span className="text-xs text-accent font-mono">{trend}</span>}
    </div>
    <div className="mt-2">
      <p className="text-text-muted text-xs uppercase tracking-wider font-semibold">{label}</p>
      <h3 className="text-2xl font-bold mt-1 font-mono">{value}</h3>
    </div>
  </div>
);

export default function App() {
  const [activeView, setActiveView] = useState<View>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [targets, setTargets] = useState<TargetProgram[]>(INITIAL_TARGETS);
  const [checklist, setChecklist] = useState<ChecklistItem[]>(CHECKLIST);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  // GitHub State
  const [githubToken, setGithubToken] = useState<string | null>(localStorage.getItem('github_token'));
  const [githubRepo, setGithubRepo] = useState<string>(localStorage.getItem('github_repo') || 'rajendrakumar-cyber/automatic-computing-machine');
  const [isPushing, setIsPushing] = useState(false);
  const [pushStatus, setPushStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  // AI Lab State
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant', content: string }[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'GITHUB_AUTH_SUCCESS') {
        const token = event.data.token;
        setGithubToken(token);
        localStorage.setItem('github_token', token);
        setPushStatus({ type: 'success', message: 'GitHub connected successfully!' });
        setTimeout(() => setPushStatus(null), 3000);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleGithubConnect = async () => {
    try {
      const response = await fetch('/api/auth/github/url');
      const { url } = await response.json();
      window.open(url, 'github_oauth', 'width=600,height=700');
    } catch (error) {
      console.error('GitHub Auth Error:', error);
      setPushStatus({ type: 'error', message: 'Failed to initiate GitHub connection.' });
    }
  };

  const handleGithubPush = async (content: string, fileName: string) => {
    if (!githubToken || !githubRepo) {
      setPushStatus({ type: 'error', message: 'Please connect GitHub and set a repository in Settings.' });
      return;
    }

    setIsPushing(true);
    try {
      const response = await fetch('/api/github/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: githubToken,
          repo: githubRepo,
          path: `reports/${fileName}.md`,
          content,
          message: `BountyHunter OS: Exported report ${fileName}`
        })
      });

      const data = await response.json();
      if (data.success) {
        setPushStatus({ type: 'success', message: `Report pushed to GitHub: ${data.url}` });
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      console.error('GitHub Push Error:', error);
      setPushStatus({ type: 'error', message: `Failed to push to GitHub: ${error.message}` });
    } finally {
      setIsPushing(false);
      setTimeout(() => setPushStatus(null), 5000);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleChecklist = (id: string) => {
    setChecklist(prev => prev.map(item => 
      item.id === id ? { ...item, completed: !item.completed } : item
    ));
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim()) return;

    const userMessage = chatInput;
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setChatInput('');
    setIsTyping(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: userMessage,
        config: {
          systemInstruction: "You are a world-class bug bounty hunter and security researcher. Your goal is to help the user find vulnerabilities, explain security concepts, and suggest payloads or testing methodologies. Be technical, precise, and ethical. Always emphasize responsible disclosure.",
        }
      });

      const text = response.text || "I'm sorry, I couldn't process that request.";
      setMessages(prev => [...prev, { role: 'assistant', content: text }]);
    } catch (error) {
      console.error("AI Error:", error);
      setMessages(prev => [...prev, { role: 'assistant', content: "Error: Failed to connect to the AI engine. Please check your configuration." }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden data-grid">
      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ width: isSidebarOpen ? 260 : 0, opacity: isSidebarOpen ? 1 : 0 }}
        className="bg-bg border-r border-border flex flex-col z-50 overflow-hidden"
      >
        <div className="p-6 flex items-center gap-3 border-b border-border">
          <div className="w-8 h-8 bg-accent rounded flex items-center justify-center text-bg font-bold">
            <Bug size={20} />
          </div>
          <h1 className="text-xl font-bold tracking-tight">BountyHunter <span className="text-accent">OS</span></h1>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <SidebarItem 
            icon={LayoutDashboard} 
            label="Dashboard" 
            active={activeView === 'dashboard'} 
            onClick={() => setActiveView('dashboard')} 
          />
          <SidebarItem 
            icon={Target} 
            label="Targets" 
            active={activeView === 'targets'} 
            onClick={() => setActiveView('targets')} 
          />
          <SidebarItem 
            icon={Terminal} 
            label="Payload Library" 
            active={activeView === 'payloads'} 
            onClick={() => setActiveView('payloads')} 
          />
          <SidebarItem 
            icon={ShieldCheck} 
            label="Vulnerability Checklist" 
            active={activeView === 'checklist'} 
            onClick={() => setActiveView('checklist')} 
          />
          <SidebarItem 
            icon={MessageSquare} 
            label="AI Lab" 
            active={activeView === 'ailab'} 
            onClick={() => setActiveView('ailab')} 
          />
          <SidebarItem 
            icon={Settings} 
            label="Settings" 
            active={activeView === 'settings'} 
            onClick={() => setActiveView('settings')} 
          />
        </nav>

        <div className="p-4 border-t border-border">
          <div className="bg-accent/5 rounded-lg p-3 border border-accent/20">
            <div className="flex items-center gap-2 text-accent mb-1">
              <Zap size={14} />
              <span className="text-xs font-bold uppercase">Pro Tip</span>
            </div>
            <p className="text-[10px] text-text-muted leading-relaxed">
              Always check the program scope before testing. Stick to the rules of engagement.
            </p>
          </div>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Header */}
        <header className="h-16 border-b border-border flex items-center justify-between px-6 bg-bg/50 backdrop-blur-sm z-40">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-white/5 rounded-lg text-text-muted hover:text-white transition-colors"
            >
              {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <h2 className="text-lg font-semibold capitalize">{activeView}</h2>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-border rounded-full text-xs text-text-muted">
              <div className="w-2 h-2 bg-accent rounded-full animate-pulse" />
              <span>System Online</span>
            </div>
            <button className="p-2 hover:bg-white/5 rounded-full text-text-muted">
              <Search size={20} />
            </button>
          </div>
        </header>

        {/* View Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <AnimatePresence mode="wait">
            {activeView === 'dashboard' && (
              <motion.div 
                key="dashboard"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatCard label="Total Bounties" value="$12,450" icon={Zap} trend="+12%" />
                  <StatCard label="Active Targets" value="8" icon={Target} />
                  <StatCard label="Bugs Found" value="24" icon={Bug} trend="+3 this week" />
                  <StatCard label="Success Rate" value="68%" icon={ShieldCheck} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 glass-card p-6">
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="text-lg font-bold">Recent Activity</h3>
                      <button className="text-accent text-sm hover:underline">View All</button>
                    </div>
                    <div className="space-y-4">
                      {[
                        { action: 'Report Submitted', target: 'Google VRP', time: '2h ago', status: 'Pending' },
                        { action: 'Payload Copied', target: 'XSS Basic', time: '5h ago', status: 'Info' },
                        { action: 'Target Added', target: 'Airbnb', time: '1d ago', status: 'New' },
                        { action: 'Bounty Awarded', target: 'Meta', time: '3d ago', status: 'Success' },
                      ].map((item, i) => (
                        <div key={i} className="flex items-center justify-between p-3 hover:bg-white/5 rounded-lg transition-colors border border-transparent hover:border-border">
                          <div className="flex items-center gap-4">
                            <div className={cn(
                              "w-10 h-10 rounded-full flex items-center justify-center",
                              item.status === 'Success' ? "bg-accent/10 text-accent" : "bg-white/5 text-text-muted"
                            )}>
                              {item.status === 'Success' ? <Check size={18} /> : <ChevronRight size={18} />}
                            </div>
                            <div>
                              <p className="font-medium text-sm">{item.action}</p>
                              <p className="text-xs text-text-muted">{item.target}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-mono">{item.time}</p>
                            <span className={cn(
                              "text-[10px] uppercase font-bold px-2 py-0.5 rounded",
                              item.status === 'Success' ? "bg-accent/20 text-accent" : "bg-white/10 text-text-muted"
                            )}>{item.status}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="glass-card p-6">
                    <h3 className="text-lg font-bold mb-6">Quick Links</h3>
                    <div className="space-y-3">
                      {[
                        { name: 'HackerOne Directory', url: 'https://hackerone.com/directory' },
                        { name: 'Bugcrowd Programs', url: 'https://bugcrowd.com/programs' },
                        { name: 'OWASP Top 10', url: 'https://owasp.org/www-project-top-ten/' },
                        { name: 'Burp Suite Docs', url: 'https://portswigger.net/burp/documentation' },
                      ].map((link, i) => (
                        <a 
                          key={i} 
                          href={link.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center justify-between p-3 bg-white/5 rounded-lg hover:bg-accent/10 hover:text-accent transition-all group"
                        >
                          <span className="text-sm font-medium">{link.name}</span>
                          <ExternalLink size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeView === 'targets' && (
              <motion.div 
                key="targets"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex justify-between items-center">
                  <h3 className="text-2xl font-bold">Active Programs</h3>
                  <button className="flex items-center gap-2 bg-accent text-bg px-4 py-2 rounded-lg font-bold hover:bg-accent/90 transition-colors">
                    <Plus size={18} />
                    Add Program
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {targets.map(target => (
                    <div key={target.id} className="glass-card p-5 group hover:border-accent/50 transition-all">
                      <div className="flex justify-between items-start mb-4">
                        <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center text-xl font-bold">
                          {target.name.charAt(0)}
                        </div>
                        <span className={cn(
                          "text-[10px] uppercase font-bold px-2 py-1 rounded",
                          target.status === 'Active' ? "bg-accent/20 text-accent" : "bg-white/10 text-text-muted"
                        )}>{target.status}</span>
                      </div>
                      <h4 className="text-lg font-bold mb-1">{target.name}</h4>
                      <p className="text-xs text-text-muted mb-4">{target.platform}</p>
                      
                      <div className="flex items-center justify-between pt-4 border-t border-border">
                        <div>
                          <p className="text-[10px] text-text-muted uppercase font-bold">Reward Range</p>
                          <p className="text-sm font-mono text-accent">{target.reward}</p>
                        </div>
                        <a 
                          href={target.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="p-2 bg-white/5 rounded-lg hover:bg-accent/10 hover:text-accent transition-colors"
                        >
                          <ExternalLink size={16} />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {activeView === 'payloads' && (
              <motion.div 
                key="payloads"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                className="space-y-6"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <h3 className="text-2xl font-bold">Payload Library</h3>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
                    <input 
                      type="text" 
                      placeholder="Search payloads..." 
                      className="bg-white/5 border border-border rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-accent w-full md:w-64"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {PAYLOADS.map(payload => (
                    <div key={payload.id} className="glass-card p-5 flex flex-col md:flex-row md:items-center gap-6">
                      <div className="md:w-32 flex-shrink-0">
                        <span className="text-[10px] uppercase font-bold px-2 py-1 bg-accent/10 text-accent rounded">
                          {payload.category}
                        </span>
                        <h4 className="font-bold mt-2">{payload.name}</h4>
                      </div>
                      <div className="flex-1">
                        <div className="bg-black/40 rounded-lg p-3 font-mono text-sm border border-border flex items-center justify-between group">
                          <code className="text-accent break-all">{payload.content}</code>
                          <button 
                            onClick={() => handleCopy(payload.content, payload.id)}
                            className="ml-4 p-2 hover:bg-white/10 rounded-lg text-text-muted hover:text-white transition-colors"
                          >
                            {copiedId === payload.id ? <Check size={16} className="text-accent" /> : <Copy size={16} />}
                          </button>
                        </div>
                        <p className="text-xs text-text-muted mt-2">{payload.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {activeView === 'checklist' && (
              <motion.div 
                key="checklist"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="max-w-3xl mx-auto space-y-6"
              >
                <div className="text-center mb-8">
                  <h3 className="text-3xl font-bold">Security Checklist</h3>
                  <p className="text-text-muted mt-2">Follow the OWASP methodology to ensure complete coverage.</p>
                </div>

                <div className="space-y-8">
                  {['Recon', 'Auth', 'Injection'].map(category => (
                    <div key={category} className="space-y-3">
                      <h4 className="text-sm font-bold uppercase tracking-widest text-accent flex items-center gap-2">
                        <div className="w-1 h-4 bg-accent rounded-full" />
                        {category}
                      </h4>
                      <div className="space-y-2">
                        {checklist.filter(item => item.category === category).map(item => (
                          <button 
                            key={item.id}
                            onClick={() => toggleChecklist(item.id)}
                            className={cn(
                              "w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left",
                              item.completed 
                                ? "bg-accent/5 border-accent/30 text-accent/80" 
                                : "bg-white/5 border-border text-white hover:border-accent/40"
                            )}
                          >
                            <div className={cn(
                              "w-6 h-6 rounded-md border flex items-center justify-center transition-colors",
                              item.completed ? "bg-accent border-accent text-bg" : "border-border"
                            )}>
                              {item.completed && <Check size={14} />}
                            </div>
                            <span className={cn("flex-1 font-medium", item.completed && "line-through opacity-50")}>
                              {item.task}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {activeView === 'ailab' && (
              <motion.div 
                key="ailab"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full flex flex-col max-w-4xl mx-auto"
              >
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-bold">AI Vulnerability Lab</h3>
                  {messages.length > 0 && (
                    <button 
                      onClick={() => handleGithubPush(
                        messages.map(m => `### ${m.role === 'user' ? 'Researcher' : 'AI Assistant'}\n\n${m.content}`).join('\n\n---\n\n'),
                        `report-${Date.now()}`
                      )}
                      disabled={isPushing || !githubToken}
                      className="flex items-center gap-2 px-3 py-1.5 bg-accent/10 text-accent border border-accent/20 rounded-lg text-xs font-bold hover:bg-accent/20 transition-all disabled:opacity-50"
                    >
                      <FileUp size={14} />
                      {isPushing ? 'Pushing...' : 'Export to GitHub'}
                    </button>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto space-y-6 pb-6 pr-2">
                  {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-6">
                      <div className="w-16 h-16 bg-accent/10 text-accent rounded-2xl flex items-center justify-center">
                        <MessageSquare size={32} />
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold">AI Vulnerability Lab</h3>
                        <p className="text-text-muted max-w-md mt-2">
                          Analyze code snippets, explain complex bugs, or get testing advice from your AI security partner.
                        </p>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-lg">
                        {[
                          "Explain SSRF in simple terms",
                          "How to test for IDOR?",
                          "Analyze this JS for vulnerabilities",
                          "Suggest XSS payloads for a search bar"
                        ].map((prompt, i) => (
                          <button 
                            key={i}
                            onClick={() => setChatInput(prompt)}
                            className="p-3 bg-white/5 border border-border rounded-xl text-sm text-left hover:border-accent/50 hover:bg-accent/5 transition-all"
                          >
                            {prompt}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    messages.map((msg, i) => (
                      <div key={i} className={cn(
                        "flex gap-4 p-4 rounded-2xl",
                        msg.role === 'user' ? "bg-white/5 ml-12" : "bg-accent/5 border border-accent/10 mr-12"
                      )}>
                        <div className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                          msg.role === 'user' ? "bg-white/10 text-white" : "bg-accent text-bg"
                        )}>
                          {msg.role === 'user' ? <Code2 size={16} /> : <Zap size={16} />}
                        </div>
                        <div className="flex-1 overflow-hidden">
                          <p className="text-[10px] uppercase font-bold mb-1 opacity-50">
                            {msg.role === 'user' ? 'Researcher' : 'AI Assistant'}
                          </p>
                          <div className="markdown-body">
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                  {isTyping && (
                    <div className="flex gap-4 p-4 rounded-2xl bg-accent/5 border border-accent/10 mr-12">
                      <div className="w-8 h-8 rounded-lg bg-accent text-bg flex items-center justify-center">
                        <Zap size={16} className="animate-pulse" />
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                <div className="p-4 bg-bg border border-border rounded-2xl mt-4">
                  <form 
                    onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
                    className="flex gap-2"
                  >
                    <input 
                      type="text" 
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Ask about a vulnerability or paste code..." 
                      className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-2"
                    />
                    <button 
                      type="submit"
                      disabled={!chatInput.trim() || isTyping}
                      className="p-2 bg-accent text-bg rounded-lg hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <Send size={18} />
                    </button>
                  </form>
                </div>
              </motion.div>
            )}

            {activeView === 'settings' && (
              <motion.div 
                key="settings"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="max-w-2xl mx-auto space-y-8"
              >
                <div className="glass-card p-8 space-y-6">
                  <div className="flex items-center gap-4 border-b border-border pb-6">
                    <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center text-white">
                      <Github size={24} />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">GitHub Integration</h3>
                      <p className="text-sm text-text-muted">Connect your GitHub account to export reports and findings.</p>
                    </div>
                  </div>

                  {!githubToken ? (
                    <div className="space-y-4">
                      <p className="text-sm text-text-muted leading-relaxed">
                        To enable GitHub exports, you need to connect your account. This will allow BountyHunter OS to push files to your repositories.
                      </p>
                      <button 
                        onClick={handleGithubConnect}
                        className="flex items-center gap-2 bg-white text-bg px-6 py-3 rounded-xl font-bold hover:bg-white/90 transition-all"
                      >
                        <Github size={20} />
                        Connect GitHub Account
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between p-4 bg-accent/5 border border-accent/20 rounded-xl">
                        <div className="flex items-center gap-3">
                          <Check size={20} className="text-accent" />
                          <span className="font-medium">GitHub Connected</span>
                        </div>
                        <button 
                          onClick={() => {
                            setGithubToken(null);
                            localStorage.removeItem('github_token');
                          }}
                          className="text-xs text-red-400 hover:underline"
                        >
                          Disconnect
                        </button>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase text-text-muted">Target Repository</label>
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            value={githubRepo}
                            onChange={(e) => {
                              setGithubRepo(e.target.value);
                              localStorage.setItem('github_repo', e.target.value);
                            }}
                            placeholder="username/repository" 
                            className="flex-1 bg-white/5 border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent"
                          />
                        </div>
                        <p className="text-[10px] text-text-muted">Example: rajendrakumar-cyber/bug-bounty-reports</p>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Floating Alert for Status */}
      <AnimatePresence>
        {(copiedId || pushStatus) && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className={cn(
              "fixed bottom-8 right-8 px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg z-[100]",
              pushStatus?.type === 'error' ? "bg-red-500 text-white" : "bg-accent text-bg"
            )}
          >
            {pushStatus?.type === 'error' ? <AlertCircle size={18} /> : <Check size={18} />}
            {copiedId ? "Copied to clipboard" : pushStatus?.message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
