export interface FileNode {
  id: string; // misal: 'folder_/path/to' atau 'file_123'
  name: string;
  path: string;
  type: 'folder' | 'file';
  file?: any;
  children?: FileNode[];
  depth: number;
}

export interface FlatRow {
  id: string;
  name: string;
  path: string;
  type: 'folder' | 'file';
  file?: any;
  depth: number;
}

/**
 * Mencari prefix path umum dari daftar path berkas lokal.
 * Contoh: ['/a/b/c/1.txt', '/a/b/c/d/2.txt'] -> '/a/b/c'
 */
export const getCommonPrefix = (paths: string[]): string => {
  if (paths.length === 0) return '';
  
  // Hanya ambil path absolut yang valid (Unix: /path, Windows: C:\path atau C:/path)
  const isAbsolute = (p: string) => /^([a-zA-Z]:[\\\/]|\/)/.test(p);
  const normalizedPaths = paths
    .filter(p => p && isAbsolute(p))
    .map(p => p.replace(/\\/g, '/'));

  if (normalizedPaths.length === 0) return '';

  const splitPaths = normalizedPaths.map(p => p.split('/'));
  const first = splitPaths[0];
  let commonLength = 0;

  for (let col = 0; col < first.length - 1; col++) {
    const segment = first[col];
    const isCommon = splitPaths.every(p => p[col] === segment);
    if (isCommon) {
      commonLength++;
    } else {
      break;
    }
  }

  const commonSegments = first.slice(0, commonLength);
  return commonSegments.join('/');
};

/**
 * Membangun pohon direktori (Tree) secara rekursif dari daftar file lokal flat.
 */
export const buildLocalFileTree = (localFiles: any[], commonPrefix: string): FileNode[] => {
  const root: Record<string, any> = { children: {} };

  localFiles.forEach(file => {
    // Dapatkan path relatif terhadap commonPrefix
    if (!file || !file.path) return;
    let relativePath = file.path;
    if (commonPrefix && file.path.startsWith(commonPrefix)) {
      relativePath = file.path.substring(commonPrefix.length);
    }

    if (relativePath.startsWith('/')) {
      relativePath = relativePath.substring(1);
    }

    const pathParts = relativePath.split('/').filter((p: string) => p.length > 0);
    let current = root;
    let accumulatedPath = commonPrefix;

    for (let i = 0; i < pathParts.length; i++) {
      const part = pathParts[i];
      accumulatedPath = accumulatedPath + (accumulatedPath.endsWith('/') ? '' : '/') + part;
      const isLast = i === pathParts.length - 1;

      if (isLast) {
        current.children[part] = {
          id: `file_${file.id}`,
          name: part,
          path: file.path,
          type: 'file',
          file: file,
          depth: 0
        };
      } else {
        if (!current.children[part]) {
          current.children[part] = {
            id: `folder_${accumulatedPath}`,
            name: part,
            path: accumulatedPath,
            type: 'folder',
            children: {}
          };
        }
        current = current.children[part];
      }
    }
  });

  // Konversi struktur nested object ke array FileNode
  const convertToArray = (node: any, depth: number = 0): FileNode[] => {
    if (node.type === 'file') {
      return [{ ...node, depth }];
    }

    const childrenList: FileNode[] = [];
    for (const key in node.children) {
      const childNode = node.children[key];
      const childTree = convertToArray(childNode, depth + 1);
      if (childTree.length > 0) {
        childrenList.push(childTree[0]);
      }
    }

    if (node === root) {
      return childrenList;
    }

    return [{
      id: node.id,
      name: node.name,
      path: node.path,
      type: 'folder',
      children: childrenList,
      depth
    }];
  };

  return convertToArray(root, 0);
};

/**
 * Meratakan pohon direktori (Tree Node) menjadi array flat baris (FlatRow)
 * yang hanya berisi node yang dapat dilihat (visibel) berdasarkan state expandedFolders.
 */
export const flattenTree = (
  nodes: FileNode[],
  expanded: Record<string, boolean>,
  depth: number = 0
): FlatRow[] => {
  const rows: FlatRow[] = [];
  
  nodes.forEach(node => {
    rows.push({
      id: node.id,
      name: node.name,
      path: node.path,
      type: node.type,
      file: node.file,
      depth
    });

    if (node.type === 'folder' && expanded[node.path] && node.children) {
      rows.push(...flattenTree(node.children, expanded, depth + 1));
    }
  });

  return rows;
};
