"use client";

import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Trophy, Calendar, Clock, User as UserIcon } from 'lucide-react';
import Link from 'next/link';

interface MemberStats {
  id: string;
  name: string;
  todaySeconds: number;
  yesterdaySeconds: number;
  lastSundaySeconds: number;
  totalSeconds: number;
}

interface GroupStats {
  groupName: string;
  stats: MemberStats[];
}

export default function StatsPage() {
  const [stats, setStats] = useState<GroupStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const formatTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const fetchStats = useCallback(async () => {
    const savedUser = localStorage.getItem('studyUser');
    if (!savedUser) {
      setError("Please login on the home page first.");
      setLoading(false);
      return;
    }

    const { groupId } = JSON.parse(savedUser);
    if (!groupId) {
      setError("You are not in a group. Join one on the home page!");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/stats?groupId=${groupId}`);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      } else {
        setError("Failed to fetch statistics.");
      }
    } catch (e) {
      setError("An error occurred while fetching stats.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  if (loading) {
    return (
      <div className="container">
        <p>Loading stats...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container">
        <Link href="/" className="secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', textDecoration: 'none' }}>
          <ArrowLeft size={16} /> Back
        </Link>
        <div className="status-badge status-error">{error}</div>
      </div>
    );
  }

  return (
    <div className="container">
      <Link href="/" className="secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', textDecoration: 'none' }}>
        <ArrowLeft size={16} /> Back to Timer
      </Link>

      <h1>Group Analytics: {stats?.groupName}</h1>

      <div className="stats-grid" style={{ display: 'grid', gap: '1.5rem', marginTop: '1rem' }}>
        {stats?.stats.map((member) => (
          <div key={member.id} className="study-log" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', borderBottom: '1px solid var(--card-border)', paddingBottom: '0.5rem' }}>
              <UserIcon size={20} />
              <h3 style={{ margin: 0 }}>{member.name}</h3>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '1rem' }}>
              <div className="stat-card">
                <span style={{ fontSize: '0.8rem', opacity: 0.7, display: 'block' }}>Today</span>
                <strong style={{ fontSize: '1.2rem' }}>{formatTime(member.todaySeconds)}</strong>
              </div>
              <div className="stat-card">
                <span style={{ fontSize: '0.8rem', opacity: 0.7, display: 'block' }}>Yesterday</span>
                <strong style={{ fontSize: '1.2rem' }}>{formatTime(member.yesterdaySeconds)}</strong>
              </div>
              <div className="stat-card">
                <span style={{ fontSize: '0.8rem', opacity: 0.7, display: 'block' }}>Last Sunday</span>
                <strong style={{ fontSize: '1.2rem' }}>{formatTime(member.lastSundaySeconds)}</strong>
              </div>
              <div className="stat-card" style={{ background: 'var(--primary)', color: 'white', borderRadius: '8px', padding: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', opacity: 0.9, display: 'block' }}>Total All Time</span>
                <strong style={{ fontSize: '1.2rem' }}>{formatTime(member.totalSeconds)}</strong>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
