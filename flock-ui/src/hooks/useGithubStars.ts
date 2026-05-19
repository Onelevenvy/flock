import { useState, useEffect } from 'react';

export function useGithubStars() {
  const [stars, setStars] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    async function fetchRepoData() {
      try {
        const response = await fetch('https://api.github.com/repos/Onelevenvy/flock');
        if (!response.ok) return;
        const data = await response.json();
        if (active) {
          if (typeof data.stargazers_count === 'number') {
            setStars(data.stargazers_count);
          }
        }
      } catch (err) {
        console.error('Failed to fetch github stars:', err);
      }
    }
    fetchRepoData();
    return () => {
      active = false;
    };
  }, []);

  return { stars };
}
