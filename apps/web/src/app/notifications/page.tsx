'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatDate } from '@reliefchain/shared-types';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'react-hot-toast';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import { getCachedData, isCacheFresh, setCachedData, invalidateCache } from '../../lib/api-cache';

export default function NotificationsPage() {
  const cachedNotifications = getCachedData<any[]>('notifications_list');
  const [notifications, setNotifications] = useState<any[]>(() => cachedNotifications || []);
  const [loading, setLoading] = useState(() => !cachedNotifications || cachedNotifications.length === 0);
  const [error, setError] = useState('');
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('user');
      if (stored) setUser(JSON.parse(stored));
    } catch {}

    if (!isCacheFresh('notifications_list', 15000)) {
      fetchNotifications();
    }
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch notifications');
      const data = await res.json();
      setCachedData('notifications_list', data);
      setNotifications(data);
    } catch (e: any) {
      if (!cachedNotifications) {
        setError(e.message);
        toast.error(e.message || 'Error fetching notifications');
      }
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      const idempotencyKey = uuidv4();
      const res = await fetch(`/api/notifications/${id}/read`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey
        }
      });
      if (res.ok) {
        const updated = notifications.map(n => n.id === id ? { ...n, status: 'READ' } : n);
        setCachedData('notifications_list', updated);
        setNotifications(updated);
        toast.success('Marked as read');
      }
    } catch (e) {
      toast.error('Failed to mark as read');
    }
  };

  if (loading) return <div className="p-10 text-center text-forest/50">Loading notifications...</div>;
  if (error) return <div className="p-10 text-center text-terracotta">{error}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-forest">Your Notifications</h1>
      </div>

      <Card noPadding>
        {notifications.length === 0 ? (
          <div className="p-10 text-center text-forest/50">
            You have no notifications.
          </div>
        ) : (
          <div className="divide-y divide-forest/10">
            {notifications.map((n) => (
              <div key={n.id} className={`p-6 transition-colors flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 ${n.status === 'UNREAD' ? 'bg-forest/5' : 'bg-white hover:bg-sand/30'}`}>
                <div className="flex-1 pr-4">
                  <div className="flex items-center space-x-3 mb-2">
                    {n.status === 'UNREAD' && <span className="w-2.5 h-2.5 bg-terracotta rounded-full"></span>}
                    <h3 className={`font-bold ${n.status === 'UNREAD' ? 'text-forest' : 'text-forest/70'}`}>{n.title}</h3>
                    <Badge variant="neutral">{n.type.replace(/_/g, ' ')}</Badge>
                  </div>
                  <p className="text-sm text-forest/80 font-medium">{n.message}</p>
                  <div className="text-xs text-forest/50 mt-2 font-mono">
                    {formatDate(n.createdAt)}
                  </div>
                </div>
                
                <div className="flex space-x-3 items-center">
                  {n.entityType === 'Allocation' && (
                    <Link 
                      href={user?.role === 'NGO_ADMIN' || user?.role === 'NGO_OPERATOR' ? '/dashboard/ngo/allocations' : '/dashboard/authority/allocations'} 
                      className="text-xs text-forest border border-forest px-4 py-2 rounded-lg hover:bg-sand transition-colors font-bold"
                    >
                      View Allocation
                    </Link>
                  )}
                  
                  {n.status === 'UNREAD' && (
                    <Button 
                      variant="outline"
                      onClick={() => markAsRead(n.id)}
                      className="text-xs px-4 py-2 bg-white"
                    >
                      Mark as Read
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
