import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import type { FileNode } from "../fs/types";
import type { NoteMeta } from "../tagIndex";
import { FileIcon } from "./FileIcon";
import {
  VscChevronRight,
  VscChevronDown,
  VscNewFile,
  VscNewFolder,
  VscRefresh,
  VscTrash,
  VscEdit,
  VscFile,
  VscCopy,
  VscSearch,
  VscClose,
  VscPin,
  VscPinned,
  VscTag,
} from "react-icons/vsc";
import "./FileTree.css";
import { ContextMenu, ContextMenuItem } from "./ContextMenu";

type NodeType = "file" | "directory";
type FileTreeProps = {
  files: FileNode[];
  onFileSelect: (path: string) => void;
  onRefresh: () => void;
  onCreateFile: (parentPath: string | undefined, fileName: string) => void;
  onCreateFolder: (parentPath: string | undefined, folderName: string) => void;
  onDeleteFile: (path: string) => void;
  onRenameFile: (oldPath: string, newName: string) => void;
  onMoveFile: (sourcePath: string, targetDirPath: string) => void;
  selectedFile: string | null;
  pinnedPaths: string[];
  onTogglePin: (path: string) => void;
  /** Frontmatter `tags`/`category` per file path, used to power tag/category browsing and search tokens. */
  metaByPath: Record<string, NoteMeta>;
};

type FileTreeNodeProps = {
  node: FileNode;
  onFileSelect: (path: string) => void;
  onContextMenu: (e: React.MouseEvent, node: FileNode) => void;
  onStartRename: (node: FileNode) => void;
  renamingPath: string | null;
  renamingValue: string;
  onRenamingChange: (value: string) => void;
  onRenamingComplete: () => void;
  onRenamingCancel: () => void;
  creatingInPath: string | undefined;
  creatingType: NodeType | null;
  creatingValue: string;
  onCreatingChange: (value: string) => void;
  onCreatingComplete: () => void;
  onCreatingCancel: () => void;
  selectedFile: string | null;
  level: number;
  forceExpand: boolean;
  onDragStart: (node: FileNode) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent, node: FileNode) => void;
  onDrop: (e: React.DragEvent, node: FileNode) => void;
  onDragLeave: () => void;
  draggingPath: string | null;
  dragOverPath: string | null;
  pinnedSet: Set<string>;
  onTogglePin: (path: string) => void;
};

type CreateInputProps = {
  value: string;
  onChange: (value: string) => void;
  onComplete: () => void;
  onCancel: () => void;
  type: NodeType;
  level: number;
};

type DragState = {
  draggingNode: FileNode | null;
  dragOverNode: FileNode | null;
  dragOverRoot: boolean;
};

const CreateInput = ({ value, onChange, onComplete, onCancel, type, level }: CreateInputProps) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onComplete();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <div className="file-tree-node">
      <div className="file-tree-item creating" style={{ paddingLeft: `${level * 12 + 4}px` }}>
        <span className="file-tree-spacer" />
        <FileIcon fileName={type === "directory" ? "" : "file.txt"} isDirectory={type === "directory"} isExpanded={false} />
        <input
          ref={inputRef}
          type="text"
          className="file-tree-rename-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onComplete}
          onKeyDown={handleKeyDown}
          placeholder={type === "directory" ? "Folder name" : "File name"}
        />
      </div>
    </div>
  );
};

const FileTreeNode = ({
  node,
  onFileSelect,
  onContextMenu,
  onStartRename,
  renamingPath,
  renamingValue,
  onRenamingChange,
  onRenamingComplete,
  onRenamingCancel,
  creatingInPath,
  creatingType,
  creatingValue,
  onCreatingChange,
  onCreatingComplete,
  onCreatingCancel,
  selectedFile,
  level,
  forceExpand,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onDragLeave,
  draggingPath,
  dragOverPath,
  pinnedSet,
  onTogglePin,
}: FileTreeNodeProps) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  const isRenaming = renamingPath === node.path;
  const isDragging = draggingPath === node.path;
  const isDragOver = dragOverPath === node.path;
  const isSelected = selectedFile === node.path;
  const isPinned = node.type === "file" && pinnedSet.has(node.path);
  const expanded = forceExpand || isExpanded;

  useEffect(() => {
    if (isRenaming) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isRenaming]);

  const handleClick = useCallback(() => {
    if (node.type === "directory") {
      setIsExpanded(!isExpanded);
    } else {
      onFileSelect(node.path);
    }
  }, [node, isExpanded, onFileSelect]);

  const handleDoubleClick = useCallback(() => {
    onStartRename(node);
  }, [node, onStartRename]);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      onContextMenu(e, node);
    },
    [node, onContextMenu],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        onRenamingComplete();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onRenamingCancel();
      } else if (e.key === "F2" && !isRenaming) {
        e.preventDefault();
        onStartRename(node);
      }
    },
    [node, isRenaming, onStartRename, onRenamingComplete, onRenamingCancel],
  );

  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      if (isRenaming) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      e.stopPropagation();
      onDragStart(node);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", node.path);
      e.dataTransfer.setDragImage(e.currentTarget as HTMLElement, 0, 0);
    },
    [node, onDragStart, isRenaming],
  );

  const handleDragEnd = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onDragEnd();
    },
    [onDragEnd],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      if (node.type === "directory") {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = "move";
        onDragOver(e, node);
      }
    },
    [node, onDragOver],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onDrop(e, node);
    },
    [node, onDrop],
  );

  const handleDragLeave = useCallback(
    (e: React.DragEvent) => {
      if (e.currentTarget === e.target) {
        onDragLeave();
      }
    },
    [onDragLeave],
  );

  const handleTogglePin = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onTogglePin(node.path);
    },
    [node, onTogglePin],
  );

  return (
    <div className="file-tree-node">
      <div
        className={`file-tree-item ${isSelected ? "selected" : ""} ${isDragging ? "dragging" : ""} ${isDragOver ? "drag-over" : ""} ${isPinned ? "pinned" : ""}`}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
        onKeyDown={handleKeyDown}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onDragLeave={handleDragLeave}
        draggable={!isRenaming}
        tabIndex={0}
        style={{ paddingLeft: `${level * 12 + 4}px` }}
      >
        {node.type === "directory" && (
          <span className="file-tree-chevron">
            {expanded ? <VscChevronDown size={16} /> : <VscChevronRight size={16} />}
          </span>
        )}
        {node.type === "file" && <span className="file-tree-spacer" />}
        <FileIcon fileName={node.name} isDirectory={node.type === "directory"} isExpanded={expanded} />
        {isRenaming ? (
          <input
            ref={inputRef}
            type="text"
            className="file-tree-rename-input"
            value={renamingValue}
            onChange={(e) => onRenamingChange(e.target.value)}
            onBlur={onRenamingComplete}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="file-tree-name">{node.name}</span>
        )}
        {node.type === "file" && !isRenaming && (
          <button
            type="button"
            className={`file-tree-pin-btn ${isPinned ? "pinned" : ""}`}
            onClick={handleTogglePin}
            title={isPinned ? "Unpin" : "Pin"}
            aria-label={isPinned ? "Unpin note" : "Pin note"}
          >
            {isPinned ? <VscPinned size={14} /> : <VscPin size={14} />}
          </button>
        )}
      </div>

      {node.type === "directory" && expanded && (
        <div className="file-tree-children">
          {creatingInPath === node.path && creatingType && (
            <CreateInput
              value={creatingValue}
              onChange={onCreatingChange}
              onComplete={onCreatingComplete}
              onCancel={onCreatingCancel}
              type={creatingType}
              level={level + 1}
            />
          )}
          {node.children?.map((child) => (
            <FileTreeNode
              key={child.path}
              node={child}
              onFileSelect={onFileSelect}
              onContextMenu={onContextMenu}
              onStartRename={onStartRename}
              renamingPath={renamingPath}
              renamingValue={renamingValue}
              onRenamingChange={onRenamingChange}
              onRenamingComplete={onRenamingComplete}
              onRenamingCancel={onRenamingCancel}
              creatingInPath={creatingInPath}
              creatingType={creatingType}
              creatingValue={creatingValue}
              onCreatingChange={onCreatingChange}
              onCreatingComplete={onCreatingComplete}
              onCreatingCancel={onCreatingCancel}
              selectedFile={selectedFile}
              level={level + 1}
              forceExpand={forceExpand}
              pinnedSet={pinnedSet}
              onTogglePin={onTogglePin}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onDragOver={onDragOver}
              onDrop={onDrop}
              onDragLeave={onDragLeave}
              draggingPath={draggingPath}
              dragOverPath={dragOverPath}
            />
          ))}
        </div>
      )}
    </div>
  );
};

type ParsedSearch = { text: string; tags: string[]; category: string | null };

/** `#tag` and `@category` tokens filter by frontmatter metadata; anything else matches the file name. */
const parseSearchQuery = (query: string): ParsedSearch => {
  const tags: string[] = [];
  let category: string | null = null;
  const textParts: string[] = [];
  for (const token of query.trim().split(/\s+/).filter(Boolean)) {
    if (token.startsWith("#") && token.length > 1) {
      tags.push(token.slice(1).toLowerCase());
    } else if (token.startsWith("@") && token.length > 1) {
      category = token.slice(1).toLowerCase();
    } else {
      textParts.push(token);
    }
  }
  return { text: textParts.join(" ").toLowerCase(), tags, category };
};

const nodeMatchesFacets = (node: FileNode, parsed: ParsedSearch, metaByPath: Record<string, NoteMeta>): boolean => {
  const meta = metaByPath[node.path];
  if (parsed.tags.length > 0) {
    const fileTags = (meta?.tags ?? []).map((tag) => tag.toLowerCase());
    if (!parsed.tags.every((tag) => fileTags.includes(tag))) return false;
  }
  if (parsed.category && meta?.category?.toLowerCase() !== parsed.category) return false;
  return true;
};

const filterNodes = (nodes: FileNode[], parsed: ParsedSearch, metaByPath: Record<string, NoteMeta>): FileNode[] => {
  const hasFacetFilter = parsed.tags.length > 0 || parsed.category !== null;
  if (!parsed.text && !hasFacetFilter) return nodes;
  return nodes.flatMap((node) => {
    if (node.type === "file") {
      const nameMatches = !parsed.text || node.name.toLowerCase().includes(parsed.text);
      return nameMatches && nodeMatchesFacets(node, parsed, metaByPath) ? [node] : [];
    }
    const filteredChildren = filterNodes(node.children ?? [], parsed, metaByPath);
    if (filteredChildren.length > 0) {
      return [{ ...node, children: filteredChildren }];
    }
    // A directory name match only counts for plain-text search - tags/categories live on files.
    return !hasFacetFilter && parsed.text && node.name.toLowerCase().includes(parsed.text) ? [node] : [];
  });
};

type FacetEntry = { key: string; label: string; count: number };

/** Aggregates tags/categories (case-insensitively) across every file currently in the tree. */
const collectFacets = (nodes: FileNode[], metaByPath: Record<string, NoteMeta>) => {
  const tagCounts = new Map<string, FacetEntry>();
  const categoryCounts = new Map<string, FacetEntry>();

  const bump = (map: Map<string, FacetEntry>, raw: string) => {
    const key = raw.toLowerCase();
    const existing = map.get(key);
    if (existing) existing.count += 1;
    else map.set(key, { key, label: raw, count: 1 });
  };

  const walk = (list: FileNode[]) => {
    for (const node of list) {
      if (node.type === "file") {
        const meta = metaByPath[node.path];
        for (const tag of meta?.tags ?? []) bump(tagCounts, tag);
        if (meta?.category) bump(categoryCounts, meta.category);
      } else {
        walk(node.children ?? []);
      }
    }
  };
  walk(nodes);

  const byCountThenLabel = (a: FacetEntry, b: FacetEntry) => b.count - a.count || a.label.localeCompare(b.label);
  return {
    tags: [...tagCounts.values()].sort(byCountThenLabel),
    categories: [...categoryCounts.values()].sort(byCountThenLabel),
  };
};

const toggleTagToken = (query: string, tagKey: string): string => {
  const tokens = query.split(/\s+/).filter(Boolean);
  const idx = tokens.findIndex((t) => t.startsWith("#") && t.slice(1).toLowerCase() === tagKey);
  if (idx >= 0) tokens.splice(idx, 1);
  else tokens.push(`#${tagKey}`);
  return tokens.join(" ");
};

const toggleCategoryToken = (query: string, categoryKey: string): string => {
  const tokens = query.split(/\s+/).filter(Boolean);
  const idx = tokens.findIndex((t) => t.startsWith("@"));
  const wasActive = idx >= 0 && tokens[idx]!.slice(1).toLowerCase() === categoryKey;
  if (idx >= 0) tokens.splice(idx, 1);
  if (!wasActive) tokens.push(`@${categoryKey}`);
  return tokens.join(" ");
};

/** Recursively moves pinned files to the front of each folder's listing, keeping the rest in their existing (directory-first, alphabetical) order. */
const applyPinnedOrder = (nodes: FileNode[], pinnedSet: Set<string>): FileNode[] => {
  const sorted = [...nodes].sort((a, b) => {
    const aPinned = a.type === "file" && pinnedSet.has(a.path);
    const bPinned = b.type === "file" && pinnedSet.has(b.path);
    if (aPinned === bPinned) return 0;
    return aPinned ? -1 : 1;
  });
  return sorted.map((node) =>
    node.type === "directory" ? { ...node, children: applyPinnedOrder(node.children ?? [], pinnedSet) } : node,
  );
};

export const FileTree = ({
  files,
  onFileSelect,
  onRefresh,
  onCreateFile,
  onCreateFolder,
  onDeleteFile,
  onRenameFile,
  onMoveFile,
  selectedFile,
  pinnedPaths,
  onTogglePin,
  metaByPath,
}: FileTreeProps) => {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; node: FileNode }>();
  const [renamingNode, setRenamingNode] = useState<FileNode>();
  const [renamingValue, setRenamingValue] = useState("");
  const [creatingItem, setCreatingItem] = useState<{ parentPath: string | undefined; type: NodeType }>();
  const [creatingValue, setCreatingValue] = useState("");
  const [dragState, setDragState] = useState<DragState>({
    draggingNode: null,
    dragOverNode: null,
    dragOverRoot: false,
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [facetsCollapsed, setFacetsCollapsed] = useState(false);

  const pinnedSet = useMemo(() => new Set(pinnedPaths), [pinnedPaths]);
  const parsedQuery = useMemo(() => parseSearchQuery(searchQuery), [searchQuery]);
  const displayedFiles = useMemo(
    () => applyPinnedOrder(filterNodes(files, parsedQuery, metaByPath), pinnedSet),
    [files, parsedQuery, metaByPath, pinnedSet],
  );
  const facets = useMemo(() => collectFacets(files, metaByPath), [files, metaByPath]);
  const activeTagKeys = useMemo(() => new Set(parsedQuery.tags), [parsedQuery.tags]);

  const handleToggleTag = useCallback((tagKey: string) => {
    setSearchQuery((prev) => toggleTagToken(prev, tagKey));
  }, []);

  const handleToggleCategory = useCallback((categoryKey: string) => {
    setSearchQuery((prev) => toggleCategoryToken(prev, categoryKey));
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent, node: FileNode) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, node });
  }, []);

  const handleStartRename = useCallback((node: FileNode) => {
    setRenamingNode(node);
    setRenamingValue(node.name);
  }, []);

  const handleStartCreate = useCallback((parentPath: string | undefined, type: NodeType) => {
    setCreatingItem({ parentPath, type });
    setCreatingValue("");
  }, []);

  const getContextMenuItems = (): ContextMenuItem[] => {
    if (!contextMenu) return [];
    const { node } = contextMenu;
    const items: ContextMenuItem[] = [];

    if (node.type === "file") {
      items.push({ label: "Open", icon: <VscFile size={16} />, onClick: () => onFileSelect(node.path) });
      const isPinned = pinnedSet.has(node.path);
      items.push({
        label: isPinned ? "Unpin" : "Pin",
        icon: isPinned ? <VscPinned size={16} /> : <VscPin size={16} />,
        onClick: () => onTogglePin(node.path),
      });
      items.push({ type: "separator" });
    }

    if (node.type === "directory") {
      items.push({ label: "New File", icon: <VscNewFile size={16} />, onClick: () => handleStartCreate(node.path, "file") });
      items.push({ label: "New Folder", icon: <VscNewFolder size={16} />, onClick: () => handleStartCreate(node.path, "directory") });
      items.push({ type: "separator" });
    }

    items.push({ label: "Copy Path", icon: <VscCopy size={16} />, onClick: () => navigator.clipboard.writeText(node.path) });
    items.push({ type: "separator" });
    items.push({ label: "Rename", icon: <VscEdit size={16} />, onClick: () => handleStartRename(node) });
    items.push({ label: "Delete", icon: <VscTrash size={16} />, onClick: () => onDeleteFile(node.path) });

    return items;
  };

  const handleRenamingComplete = useCallback(() => {
    if (renamingNode) {
      const trimmedValue = renamingValue.trim();
      if (trimmedValue && trimmedValue !== renamingNode.name) {
        onRenameFile(renamingNode.path, trimmedValue);
      }
    }
    setRenamingNode(undefined);
    setRenamingValue("");
  }, [renamingNode, renamingValue, onRenameFile]);

  const handleRenamingCancel = useCallback(() => {
    setRenamingNode(undefined);
    setRenamingValue("");
  }, []);

  const handleCreatingComplete = useCallback(() => {
    if (creatingItem && creatingValue.trim()) {
      const trimmedValue = creatingValue.trim();
      if (creatingItem.type === "file") {
        onCreateFile(creatingItem.parentPath, trimmedValue);
      } else {
        onCreateFolder(creatingItem.parentPath, trimmedValue);
      }
    }
    setCreatingItem(undefined);
    setCreatingValue("");
  }, [creatingItem, creatingValue, onCreateFile, onCreateFolder]);

  const handleCreatingCancel = useCallback(() => {
    setCreatingItem(undefined);
    setCreatingValue("");
  }, []);

  const handleDragStart = useCallback((node: FileNode) => {
    setDragState((prev) => ({ ...prev, draggingNode: node }));
  }, []);

  const handleDragEnd = useCallback(() => {
    setDragState({ draggingNode: null, dragOverNode: null, dragOverRoot: false });
  }, []);

  const handleDragOver = useCallback(
    (_e: React.DragEvent, node: FileNode) => {
      if (!dragState.draggingNode || dragState.draggingNode.path === node.path) return;
      const isDescendant = node.path.startsWith(dragState.draggingNode.path + "/");
      if (!isDescendant) {
        setDragState((prev) => ({ ...prev, dragOverNode: node }));
      }
    },
    [dragState.draggingNode],
  );

  const handleDrop = useCallback(
    (_e: React.DragEvent, targetNode: FileNode) => {
      if (!dragState.draggingNode || targetNode.type !== "directory") {
        setDragState({ draggingNode: null, dragOverNode: null, dragOverRoot: false });
        return;
      }
      const canDrop =
        dragState.draggingNode.path !== targetNode.path &&
        !targetNode.path.startsWith(dragState.draggingNode.path + "/");
      if (canDrop) {
        onMoveFile(dragState.draggingNode.path, targetNode.path);
      }
      setDragState({ draggingNode: null, dragOverNode: null, dragOverRoot: false });
    },
    [dragState.draggingNode, onMoveFile],
  );

  const handleDragLeave = useCallback(() => {
    setDragState((prev) => ({ ...prev, dragOverNode: null }));
  }, []);

  const handleRootDragOver = useCallback(
    (e: React.DragEvent) => {
      if (dragState.draggingNode && e.target === e.currentTarget) {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = "move";
        setDragState((prev) => ({ ...prev, dragOverRoot: true, dragOverNode: null }));
      }
    },
    [dragState.draggingNode],
  );

  const handleRootDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.target === e.currentTarget && dragState.draggingNode) {
        onMoveFile(dragState.draggingNode.path, "/");
      }
      setDragState({ draggingNode: null, dragOverNode: null, dragOverRoot: false });
    },
    [dragState.draggingNode, onMoveFile],
  );

  const handleRootDragLeave = useCallback((e: React.DragEvent) => {
    if (e.target === e.currentTarget) {
      setDragState((prev) => ({ ...prev, dragOverRoot: false }));
    }
  }, []);

  const contentClassName = `file-tree-content ${dragState.dragOverRoot ? "drag-over-root" : ""}`;

  return (
    <div className="file-tree-container">
      <div className="file-tree-header">
        <div className="file-tree-header-left">
          <span className="file-tree-title">FILES</span>
        </div>
        <div className="file-tree-actions">
          <button className="file-tree-action-btn" onClick={() => handleStartCreate(undefined, "file")} title="New File">
            <VscNewFile size={16} />
          </button>
          <button className="file-tree-action-btn" onClick={() => handleStartCreate(undefined, "directory")} title="New Folder">
            <VscNewFolder size={16} />
          </button>
          <button className="file-tree-action-btn" onClick={onRefresh} title="Refresh">
            <VscRefresh size={16} />
          </button>
        </div>
      </div>

      <div className="file-tree-search">
        <VscSearch size={14} className="file-tree-search-icon" />
        <input
          type="text"
          className="file-tree-search-input"
          placeholder="Search files..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button className="file-tree-search-clear" onClick={() => setSearchQuery("")} title="Clear search" aria-label="Clear search">
            <VscClose size={14} />
          </button>
        )}
      </div>

      {(facets.tags.length > 0 || facets.categories.length > 0) && (
        <div className="file-tree-facets">
          <button
            type="button"
            className="file-tree-facets-header"
            onClick={() => setFacetsCollapsed((value) => !value)}
            aria-expanded={!facetsCollapsed}
          >
            {facetsCollapsed ? <VscChevronRight size={14} /> : <VscChevronDown size={14} />}
            <VscTag size={13} />
            <span>Tags & Categories</span>
          </button>
          {!facetsCollapsed && (
            <div className="file-tree-facets-body">
              {facets.tags.length > 0 && (
                <div className="file-tree-facet-group">
                  {facets.tags.map((tag) => (
                    <button
                      key={tag.key}
                      type="button"
                      className={`file-tree-facet-chip ${activeTagKeys.has(tag.key) ? "active" : ""}`}
                      onClick={() => handleToggleTag(tag.key)}
                      title={`Filter by #${tag.label}`}
                    >
                      #{tag.label}
                      <span className="file-tree-facet-count">{tag.count}</span>
                    </button>
                  ))}
                </div>
              )}
              {facets.categories.length > 0 && (
                <div className="file-tree-facet-group">
                  {facets.categories.map((category) => (
                    <button
                      key={category.key}
                      type="button"
                      className={`file-tree-facet-chip category ${parsedQuery.category === category.key ? "active" : ""}`}
                      onClick={() => handleToggleCategory(category.key)}
                      title={`Filter by category: ${category.label}`}
                    >
                      {category.label}
                      <span className="file-tree-facet-count">{category.count}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className={contentClassName} onDragOver={handleRootDragOver} onDrop={handleRootDrop} onDragLeave={handleRootDragLeave}>
        {creatingItem?.parentPath === undefined && creatingItem?.type && (
          <CreateInput
            value={creatingValue}
            onChange={setCreatingValue}
            onComplete={handleCreatingComplete}
            onCancel={handleCreatingCancel}
            type={creatingItem.type}
            level={0}
          />
        )}
        {displayedFiles.length === 0 && !creatingItem ? (
          <div className="file-tree-empty">{searchQuery ? "No matching files" : "No files"}</div>
        ) : (
          displayedFiles.map((node) => (
            <FileTreeNode
              key={node.path}
              node={node}
              onFileSelect={onFileSelect}
              onContextMenu={handleContextMenu}
              onStartRename={handleStartRename}
              renamingPath={renamingNode?.path ?? null}
              renamingValue={renamingValue}
              onRenamingChange={setRenamingValue}
              onRenamingComplete={handleRenamingComplete}
              onRenamingCancel={handleRenamingCancel}
              creatingInPath={creatingItem?.parentPath}
              creatingType={creatingItem?.type ?? null}
              creatingValue={creatingValue}
              onCreatingChange={setCreatingValue}
              onCreatingComplete={handleCreatingComplete}
              onCreatingCancel={handleCreatingCancel}
              selectedFile={selectedFile}
              level={0}
              forceExpand={!!searchQuery}
              pinnedSet={pinnedSet}
              onTogglePin={onTogglePin}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onDragLeave={handleDragLeave}
              draggingPath={dragState.draggingNode?.path ?? null}
              dragOverPath={dragState.dragOverNode?.path ?? null}
            />
          ))
        )}
      </div>

      {contextMenu && <ContextMenu x={contextMenu.x} y={contextMenu.y} items={getContextMenuItems()} onClose={() => setContextMenu(undefined)} />}
    </div>
  );
};
