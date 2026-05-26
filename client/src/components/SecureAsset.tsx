import { useState, useEffect } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

// Module-level cache: avoids re-fetching signed URLs on every component mount/render.
// URLs are generated with 1h (3600s) validity; we cache for 50 minutes to avoid stale URLs.
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();
const CACHE_TTL_MS = 50 * 60 * 1000; // 50 minutes

interface SecureAssetProps {
  bucket: string;
  path: string | null | undefined;
  type: 'image' | 'audio' | 'video';
  className?: string;
  alt?: string;
  autoPlay?: boolean;
  controls?: boolean;
}

export function SecureAsset({ 
  bucket, 
  path, 
  type, 
  className = '', 
  alt = 'Asset',
  autoPlay = false,
  controls = true
}: SecureAssetProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!path) {
      setLoading(false);
      return;
    }

    // If it's already a full URL (legacy or public) or a data URL (Base64), just use it
    if (path.startsWith('http') || path.startsWith('data:')) {
      setSignedUrl(path);
      setLoading(false);
      return;
    }

    let isMounted = true;

    async function fetchSignedUrl() {
      try {
        setLoading(true);
        setError(null);

        // Check module-level cache first
        const cacheKey = `${bucket}:${path}`;
        const cached = signedUrlCache.get(cacheKey);
        if (cached && Date.now() < cached.expiresAt) {
          if (isMounted) {
            setSignedUrl(cached.url);
            setLoading(false);
          }
          return;
        }
        
        // Create a signed URL valid for 1 hour (3600 seconds)
        const { data, error } = await supabase
          .storage
          .from(bucket)
          .createSignedUrl(path!, 3600);

        if (error) throw error;

        if (isMounted) {
          setSignedUrl(data.signedUrl);
          // Store in module-level cache
          signedUrlCache.set(cacheKey, {
            url: data.signedUrl,
            expiresAt: Date.now() + CACHE_TTL_MS,
          });
        }
      } catch (err) {
        // signed URL fetch failed
        if (isMounted) {
          setError('Failed to load asset');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchSignedUrl();

    return () => {
      isMounted = false;
    };
  }, [bucket, path]);

  if (!path) return null;

  if (loading) {
    return (
      <div className={`flex items-center justify-center bg-muted/20 rounded ${className} ${type === 'audio' ? 'h-10 w-full' : 'h-48 w-full'}`}>
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !signedUrl) {
    return (
        <div className={`flex items-center justify-center bg-destructive/10 text-destructive rounded p-2 ${className} ${type === 'audio' ? 'h-10 w-full' : 'h-fit'}`}>
            <AlertCircle className="w-4 h-4 mr-2" />
            <span className="text-xs">Error</span>
        </div>
    );
  }

  if (type === 'image') {
    return (
      <img 
        src={signedUrl} 
        alt={alt} 
        className={className}
        crossOrigin="anonymous"
        onError={() => setError('Failed to load image')}
      />
    );
  }

  if (type === 'audio') {
    return (
      <audio 
        src={signedUrl} 
        controls={controls}
        autoPlay={autoPlay}
        className={className}
        crossOrigin="anonymous"
        onError={() => setError('Failed to load audio')}
      />
    );
  }

  if (type === 'video') {
    return (
      <video 
        src={signedUrl} 
        controls={controls}
        autoPlay={autoPlay}
        className={className}
        crossOrigin="anonymous"
        onError={() => setError('Failed to load video')}
      />
    );
  }

  return null;
}
