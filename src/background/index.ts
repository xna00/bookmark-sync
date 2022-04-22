const enum Message {
  upload = "BOOKMARK_SYNC_UPLOAD",
  download = "BOOKMARK_SYNC_DOWNLOAD",
}

type TreeNode = Pick<chrome.bookmarks.BookmarkTreeNode, "title" | "url"> & {
  children?: TreeNode[];
};

type Data = {
  webHook?: string;
  headers?: Record<string, string>;
  mountOn?: string;
  remoteRoot?: string;
};

type BookmarkTreeNode = chrome.bookmarks.BookmarkTreeNode & { path?: string };

const storageKey = "BOOKMARKS_DATA";
const bookmarks = chrome.bookmarks;

const bookmarkTreeNodeToBookmark = (
  nodes: chrome.bookmarks.BookmarkTreeNode[]
): TreeNode[] => {
  return nodes.map((node) => ({
    title: node.title,
    url: node.url,
    children: node.children && bookmarkTreeNodeToBookmark(node.children),
  }));
};

const removeAll = (tree: BookmarkTreeNode[]): Promise<unknown> => {
  return Promise.all(
    tree.map((node) =>
      chrome.bookmarks
        .removeTree(node.id)
        .catch(() => removeAll(node.children ?? []))
    )
  );
};

const sync = (
  bookmarkTree: BookmarkTreeNode[],
  tree: TreeNode[],
  parentId = "-1"
): Promise<unknown> => {
  return Promise.all(
    tree.map((node, i) =>
      (bookmarkTree[i]
        ? Promise.resolve(bookmarkTree[i])
        : // Can't modify the root bookmark folders.
        parentId === "0"
        ? Promise.resolve(null)
        : bookmarks.create({
            parentId,
            title: node.title,
            url: node.url,
          })
      ).then(
        (res) => res && sync(res.children ?? [], node.children ?? [], res.id)
      )
    )
  );
};

const getStorageData = () =>
  chrome.storage.local
    .get(storageKey)
    .then((res) => JSON.parse(res[storageKey] || "{}") as Data);

const upload = () =>
  getStorageData()
    .then((data) => {
      if (!(data.mountOn && data.remoteRoot && data.webHook)) {
        return Promise.reject();
      }
      return chrome.bookmarks.getSubTree(data.mountOn).then((res) => ({
        data,
        body: res[0].children ?? [],
      }));
    })

    .then(({ data, body }) => {
      return fetch(data.webHook + `/${data.remoteRoot}`, {
        method: "put",
        headers: data.headers,
        body: JSON.stringify(bookmarkTreeNodeToBookmark(body)),
      });
    })
    .then((res) => res.json())
    .then((res) => {
      console.log(res);
    })
    .catch(console.log);

const download = () =>
  getStorageData()
    .then((data) => {
      if (!(data.mountOn && data.remoteRoot && data.webHook)) {
        return Promise.reject();
      }
      return Promise.all([
        bookmarks
          .getSubTree(data.mountOn)
          .then((res) => removeAll(res[0].children ?? []))
          .then(() => bookmarks.getSubTree(data.mountOn!))
          .then((r) => r[0]),
        fetch(data.webHook + `?propertyPath=${data.remoteRoot}.children`).then(
          (res) => res.json() as Promise<TreeNode[]>
        ),
      ]);
    })

    .then(([n, t]) => sync(n.children ?? [], t, n.id))
    .then(() => {
      console.log("sync done");
    })
    .catch(console.log);

download();
setInterval(download, 1000 * 60 * 30);

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === Message.upload) {
    upload();
  } else if (request.action === Message.download) {
    download();
  }
  sendResponse(request);
});
const main = async () => {
  //   const data: Data = JSON.parse(
  //     (await chrome.storage.local.get(storageKey))[storageKey] || "{}"
  //   );
  //   const headers: Record<string, string> = JSON.parse(
  //     data[Constants.headersKey] || "{}"
  //   );
  //   const webHook = data[Constants.webHook];
  //   chrome.bookmarks.getTree((result) => {
  //     console.log(result);
  //   });
  //   chrome.bookmarks.onCreated.addListener((id, bookmark) => {
  //     fetch(webHook, {
  //       method: "post",
  //       headers: {
  //         ...headers,
  //       },
  //       body: JSON.stringify(bookmark),
  //     })
  //       .then((res) => res.json())
  //       .then(console.log);
  //   });
  //   chrome.bookmarks.onRemoved.addListener((id, removeInfo) => {
  //     fetch(webHook, {
  //       method: "delete",
  //       headers: {
  //         ...headers,
  //       },
  //       body: JSON.stringify(removeInfo),
  //     })
  //       .then((res) => res.json())
  //       .then(console.log);
  //   });
  //   chrome.bookmarks.onChanged.addListener((id, changeInfo) => {
  //     fetch(`${webHook}/${id}`, {
  //       method: "patch",
  //       headers: {
  //         ...headers,
  //       },
  //       body: JSON.stringify(changeInfo),
  //     })
  //       .then((res) => res.json())
  //       .then(console.log);
  //   });
  //   chrome.bookmarks.onMoved.addListener((id, moveInfo) => {
  //     fetch(`${webHook}/move/${id}`, {
  //       method: "post",
  //       headers,
  //       body: JSON.stringify(moveInfo),
  //     })
  //       .then((res) => res.json())
  //       .then(console.log);
  //   });
};
main();
