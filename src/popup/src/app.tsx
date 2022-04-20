import { useEffect, useState } from "preact/hooks";

export const enum Message {
  upload = "BOOKMARK_SYNC_UPLOAD",
  download = "BOOKMARK_SYNC_DOWNLOAD",
}

type Data = {
  webHook?: string;
  headers?: Record<string, string>;
  mountOn?: string;
  remoteRoot?: string;
};

const storageKey = "BOOKMARKS_DATA";
type BookmarkTreeNode = chrome.bookmarks.BookmarkTreeNode & { path?: string };
const bookmarks = chrome.bookmarks;

const findFolder = (tree: BookmarkTreeNode[]) => {
  const ret: BookmarkTreeNode[] = [];
  const stack: BookmarkTreeNode[] = [
    ...tree.map((t, i) => ({
      ...t,
      path: `[${i}]`,
    })),
  ];
  while (stack.length) {
    const node = stack.shift()!;
    if (node.children) {
      node.title += "/";
      ret.push(node);
      stack.unshift(
        ...node.children.map((n, i) => ({
          ...n,
          title: `${node.title}${n.title}`,
          path: `${node.path}.children[${i}]`,
        }))
      );
    }
  }
  return ret;
};

export function App() {
  const [data, setData] = useState<Data>({});
  const [newHeaderKey, setNewHeaderKey] = useState("");
  const [localFolders, setLocalFolders] = useState<BookmarkTreeNode[]>([]);
  const [remoteFolders, setRemoteFolders] = useState<BookmarkTreeNode[]>([]);

  useEffect(() => {
    chrome.storage.local.get(storageKey).then((res) => {
      const tmp = res[storageKey];
      if (tmp) {
        setData(JSON.parse(tmp));
      }
    });
    bookmarks.getTree().then((res) => setLocalFolders(findFolder(res)));
  }, []);

  useEffect(() => {
    console.log(data);

    data.webHook &&
      fetch(data.webHook)
        .then((res) => res.json())
        .then((res) => setRemoteFolders(findFolder(res)));
  }, [data.webHook]);

  useEffect(() => {
    chrome.storage.local.set({
      [storageKey]: JSON.stringify(data),
    });
  }, [data]);

  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.target as HTMLFormElement;
          const d = Object.fromEntries(new FormData(form).entries());
          const headers: Record<string, string> = {};
          Object.entries(d).forEach(([k, v]) => {
            if (k.startsWith("headers.")) {
              const tmp = k.replace("headers.", "");
              tmp && v && (headers[tmp] = v.toString());
              delete d[k];
            }
          });
          setData({
            ...d,
            headers,
          });
        }}
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          justifyItems: "stetch",
        }}
      >
        <input
          type="text"
          placeholder="webHook"
          name="webHook"
          style={{ gridColumn: "1 / 3" }}
          value={data.webHook}
        />
        {data.headers
          ? Object.entries(data.headers).map(([k, v]) => {
              return (
                <>
                  <input type="text" value={k} />
                  <input type="text" name={`headers.${k}`} value={v} />
                </>
              );
            })
          : null}
        <input
          type="text"
          value={newHeaderKey}
          onChange={(e) => {
            const t = e.target as HTMLInputElement;
            setNewHeaderKey(t.value);
          }}
        />
        <input type="text" name={`headers.${newHeaderKey}`} />
        <select name="mountOn">
          {localFolders.map((f) => (
            <option value={f.id} selected={f.id === data.mountOn}>
              {f.title}
            </option>
          ))}
        </select>
        <select name="remoteRoot">
          {remoteFolders.map((f) => (
            <option value={f.path} selected={f.path === data.remoteRoot}>
              {f.title}
            </option>
          ))}
        </select>
        <input
          type="submit"
          style={{ gridColumn: "2 / 3", justifySelf: "end" }}
          value="保存"
        />
      </form>
      <button
        onClick={() => chrome.runtime.sendMessage({ action: Message.upload })}
      >
        上传
      </button>
      <button
        onClick={() => chrome.runtime.sendMessage({ action: Message.download })}
      >
        下载
      </button>
    </>
  );
}
