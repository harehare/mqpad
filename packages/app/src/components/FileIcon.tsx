import {
  VscFile,
  VscFileCode,
  VscNote,
  VscFolder,
  VscFolderOpened,
} from "react-icons/vsc";

type FileIconProps = {
  fileName: string;
  isDirectory: boolean;
  isExpanded?: boolean;
};

// Notion-of-a-vault: folders read as notebooks (warm accent), `.mq` files
// stay visually distinct since they're a different kind of document (a live
// query, not prose) - everything else, in particular `.md`/`.mdx`, reads as
// a plain note rather than a colour-coded file type.
export const FileIcon = ({
  fileName,
  isDirectory,
  isExpanded = false,
}: FileIconProps) => {
  if (isDirectory) {
    return isExpanded ? (
      <VscFolderOpened style={{ color: "var(--mqpad-tree-folder, #dcb67a)" }} />
    ) : (
      <VscFolder style={{ color: "var(--mqpad-tree-folder, #dcb67a)" }} />
    );
  }

  const extension = fileName.split(".").pop()?.toLowerCase();

  switch (extension) {
    case "mq":
      return <VscFileCode style={{ color: "var(--mqpad-accent)" }} />;
    case "md":
    case "mdx":
      return <VscNote style={{ color: "var(--mqpad-tree-title)" }} />;
    default:
      return <VscFile style={{ color: "var(--mqpad-tree-title)" }} />;
  }
};
