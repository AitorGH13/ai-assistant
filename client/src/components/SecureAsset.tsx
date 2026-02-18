import { useState, useEffect } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

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

    // If it's already a full URL (legacy or public), just use it
    if (path.startsWith('http')) {
      setSignedUrl(path);
      setLoading(false);
      return;
    }

    let isMounted = true;

    async function fetchSignedUrl() {
      try {
        setLoading(true);
        setError(null);
        
        // Create a signed URL valid for 1 hour (3600 seconds)
        const { data, error } = await supabase
          .storage
          .from(bucket)
          .createSignedUrl(path!, 3600);

        if (error) throw error;

        if (isMounted) {
          setSignedUrl(data.signedUrl);
        }
      } catch (err) {
        console.error(`Error fetching signed URL for ${path}:`, err);
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
        onError={() => setError('Failed to load video')}
      />
    );
  }

  return null;
}
