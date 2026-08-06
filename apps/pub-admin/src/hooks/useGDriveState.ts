import { useState, useEffect, useRef } from 'react';

export interface GDriveAccount {
  email: string;
  name: string;
  token: string;
  refreshToken: string;
  clientId: string;
  clientSecret: string;
}

interface UseGDriveStateProps {
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  fileCategory: string;
}

export function useGDriveState({ showToast, fileCategory }: UseGDriveStateProps) {
  const rootFolderId = localStorage.getItem('gdrive_parent_folder_id') || 'root';
  const [currentFolderId, setCurrentFolderId] = useState<string>(rootFolderId);
  const [folderHistory, setFolderHistory] = useState<string[]>([rootFolderId]);
  const [folderHistoryIndex, setFolderHistoryIndex] = useState<number>(0);
  const [connectedUser, setConnectedUser] = useState<{ name: string, email: string } | null>(null);

  const [gdriveAccounts, setGdriveAccountsState] = useState<GDriveAccount[]>(() => {
    try {
      const saved = localStorage.getItem('gdrive_accounts');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const gdriveAccountsRef = useRef<GDriveAccount[]>(gdriveAccounts);
  useEffect(() => {
    gdriveAccountsRef.current = gdriveAccounts;
  }, [gdriveAccounts]);

  const setGdriveAccounts = (accounts: GDriveAccount[]) => {
    setGdriveAccountsState(accounts);
    localStorage.setItem('gdrive_accounts', JSON.stringify(accounts));
  };

  const exchangeCodeForToken = async (code: string) => {
    const clientId = localStorage.getItem('gdrive_client_id') || '935478440552-k48b61cglp06gskchsc7qg6l2i1pkhn1.apps.googleusercontent.com';
    const clientSecret = localStorage.getItem('gdrive_client_secret') || '';
    const port = 50007;

    showToast('Menukar kode otorisasi...', 'info');
    try {
      const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code: code,
          redirect_uri: `http://localhost:${port}`,
          grant_type: 'authorization_code'
        })
      });

      if (res.ok) {
        const data = await res.json();
        const accessToken = data.access_token;
        const refreshToken = data.refresh_token || '';

        const profileRes = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        });

        if (profileRes.ok) {
          const profileData = await profileRes.json();
          const email = profileData.user.emailAddress;
          const name = profileData.user.displayName;

          const currentAccounts = gdriveAccountsRef.current;
          const existingAccIdx = currentAccounts.findIndex(acc => acc.email === email);
          let updatedAccounts = [...currentAccounts];

          if (existingAccIdx > -1) {
            const existingAcc = currentAccounts[existingAccIdx];
            updatedAccounts[existingAccIdx] = {
              ...existingAcc,
              name,
              token: accessToken,
              refreshToken: refreshToken || existingAcc.refreshToken,
              clientId,
              clientSecret
            };
          } else {
            updatedAccounts.push({
              email,
              name,
              token: accessToken,
              refreshToken: refreshToken,
              clientId,
              clientSecret
            });
          }

          setGdriveAccounts(updatedAccounts);

          // Set akun default
          localStorage.setItem('gdrive_token', accessToken);
          if (refreshToken) {
            localStorage.setItem('gdrive_refresh_token', refreshToken);
          }
          localStorage.setItem('gdrive_client_id', clientId);
          localStorage.setItem('gdrive_client_secret', clientSecret);

          setConnectedUser({ name, email });
          showToast(`Akun ${email} berhasil dihubungkan!`, 'success');
        } else {
          showToast('Gagal mendapatkan profil pengguna Google', 'error');
        }
      } else {
        const errData = await res.json();
        console.error('Exchange token error:', errData);
        showToast(`Gagal menukar kode otorisasi: ${errData.error_description || errData.error}`, 'error');
      }
    } catch (err: any) {
      console.error('Exchange token error:', err);
      showToast(`Error penukaran token: ${err.message || err}`, 'error');
    }
  };

  const testConnection = async (currentToken: string) => {
    if (!currentToken) {
      setConnectedUser(null);
      return;
    }
    try {
      const res = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
        headers: {
          'Authorization': `Bearer ${currentToken}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setConnectedUser({
          name: data.user.displayName,
          email: data.user.emailAddress
        });
      } else {
        setConnectedUser(null);
      }
    } catch (err) {
      console.error('Gagal menghubungkan Google API:', err);
      setConnectedUser(null);
    }
  };

  const refreshPromisesRef = useRef<Record<string, Promise<string | null>>>({});

  const refreshAccountToken = async (email: string): Promise<string | null> => {
    if (email in refreshPromisesRef.current) {
      return refreshPromisesRef.current[email];
    }

    const runRefresh = async (): Promise<string | null> => {
      const currentAccounts = gdriveAccountsRef.current;
      const account = currentAccounts.find(acc => acc.email === email);
      if (!account) return null;

      try {
        const res = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: new URLSearchParams({
            client_id: account.clientId,
            client_secret: account.clientSecret,
            refresh_token: account.refreshToken,
            grant_type: 'refresh_token'
          })
        });

        if (res.ok) {
          const data = await res.json();
          const newAccessToken = data.access_token;
          
          const updatedAccounts = gdriveAccountsRef.current.map(acc => {
            if (acc.email === email) {
              return { ...acc, token: newAccessToken };
            }
            return acc;
          });
          setGdriveAccounts(updatedAccounts);

          const defaultToken = localStorage.getItem('gdrive_token');
          const defaultEmail = connectedUser?.email;
          if (defaultEmail === email || !defaultToken) {
            localStorage.setItem('gdrive_token', newAccessToken);
            setConnectedUser({ name: account.name, email: account.email });
          }
          
          return newAccessToken;
        }
      } catch (e) {
        console.error(`Gagal refresh token untuk ${email}:`, e);
      }
      return null;
    };

    const promise = runRefresh().finally(() => {
      delete refreshPromisesRef.current[email];
    });
    refreshPromisesRef.current[email] = promise;
    return promise;
  };

  const refreshAccessToken = async (): Promise<string | null> => {
    const defaultEmail = connectedUser?.email;
    const currentAccounts = gdriveAccountsRef.current;
    if (defaultEmail && currentAccounts.some(acc => acc.email === defaultEmail)) {
      return refreshAccountToken(defaultEmail);
    }

    const key = 'default_unregistered';
    if (key in refreshPromisesRef.current) {
      return refreshPromisesRef.current[key];
    }

    const refreshToken = localStorage.getItem('gdrive_refresh_token');
    const clientId = localStorage.getItem('gdrive_client_id');
    const clientSecret = localStorage.getItem('gdrive_client_secret');

    if (!refreshToken || !clientId || !clientSecret) {
      return null;
    }

    const runRefresh = async (): Promise<string | null> => {
      try {
        const res = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: refreshToken,
            grant_type: 'refresh_token'
          })
        });

        if (res.ok) {
          const data = await res.json();
          const newAccessToken = data.access_token;
          localStorage.setItem('gdrive_token', newAccessToken);
          
          await testConnection(newAccessToken);
          return newAccessToken;
        } else {
          console.error('Respon Google OAuth refresh gagal:', res.status);
          return null;
        }
      } catch (err) {
        console.error('Gagal melakukan refresh token:', err);
        return null;
      }
    };

    const promise = runRefresh().finally(() => {
      delete refreshPromisesRef.current[key];
    });
    refreshPromisesRef.current[key] = promise;
    return promise;
  };

  useEffect(() => {
    const initConnection = async () => {
      const token = localStorage.getItem('gdrive_token');
      if (token) {
        try {
          const res = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          if (res.ok) {
            const data = await res.json();
            setConnectedUser({
              name: data.user.displayName,
              email: data.user.emailAddress
            });
          } else if (res.status === 401) {
            await refreshAccessToken();
          }
        } catch {
          await refreshAccessToken();
        }
      }
    };
    initConnection();
  }, []);

  useEffect(() => {
    const rootId = localStorage.getItem('gdrive_parent_folder_id') || 'root';
    setCurrentFolderId(rootId);
    setFolderHistory([rootId]);
    setFolderHistoryIndex(0);
  }, [fileCategory]);

  const navigateFolder = (folderId: string) => {
    const newHistory = folderHistory.slice(0, folderHistoryIndex + 1);
    newHistory.push(folderId);
    setFolderHistory(newHistory);
    setFolderHistoryIndex(newHistory.length - 1);
    setCurrentFolderId(folderId);
  };

  const navigateBack = () => {
    if (folderHistoryIndex > 0) {
      const newIndex = folderHistoryIndex - 1;
      setFolderHistoryIndex(newIndex);
      setCurrentFolderId(folderHistory[newIndex]);
    }
  };

  const navigateForward = () => {
    if (folderHistoryIndex < folderHistory.length - 1) {
      const newIndex = folderHistoryIndex + 1;
      setFolderHistoryIndex(newIndex);
      setCurrentFolderId(folderHistory[newIndex]);
    }
  };

  const canNavigateBack = folderHistoryIndex > 0;
  const canNavigateForward = folderHistoryIndex < folderHistory.length - 1;

  return {
    currentFolderId,
    setCurrentFolderId,
    folderHistory,
    folderHistoryIndex,
    connectedUser,
    setConnectedUser,
    gdriveAccounts,
    setGdriveAccounts,
    exchangeCodeForToken,
    testConnection,
    refreshAccountToken,
    refreshAccessToken,
    navigateFolder,
    navigateBack,
    navigateForward,
    canNavigateBack,
    canNavigateForward
  };
}
