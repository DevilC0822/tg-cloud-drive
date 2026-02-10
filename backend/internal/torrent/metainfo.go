package torrent

import (
	"crypto/sha1"
	"encoding/hex"
	"errors"
	"fmt"
	"net/url"
	"path"
	"sort"
	"strconv"
	"strings"
)

const maxBencodeDepth = 96

type FileEntry struct {
	Index int
	Path  string
	Name  string
	Size  int64
}

type MetaInfo struct {
	Name          string
	InfoHash      string
	TotalSize     int64
	IsPrivate     bool
	AnnounceURLs  []string
	AnnounceHosts []string
	Files         []FileEntry
}

type nodeKind int

const (
	nodeInt nodeKind = iota + 1
	nodeString
	nodeList
	nodeDict
)

type bNode struct {
	kind nodeKind

	start int
	end   int

	intVal int64
	strVal []byte
	list   []bNode
	dict   []bPair
}

type bPair struct {
	key string
	val bNode
}

func ParseMetaInfo(data []byte) (MetaInfo, error) {
	if len(data) == 0 {
		return MetaInfo{}, errors.New("torrent 内容为空")
	}
	root, next, err := parseNode(data, 0, 0)
	if err != nil {
		return MetaInfo{}, err
	}
	if next != len(data) {
		return MetaInfo{}, errors.New("torrent bencode 非法：存在多余数据")
	}
	if root.kind != nodeDict {
		return MetaInfo{}, errors.New("torrent 根节点必须是字典")
	}

	infoNode, ok := root.dictValue("info")
	if !ok {
		return MetaInfo{}, errors.New("torrent 缺少 info 字段")
	}
	if infoNode.kind != nodeDict {
		return MetaInfo{}, errors.New("torrent info 字段类型非法")
	}
	if infoNode.start < 0 || infoNode.end <= infoNode.start || infoNode.end > len(data) {
		return MetaInfo{}, errors.New("torrent info 字段边界非法")
	}
	infoHashBytes := sha1.Sum(data[infoNode.start:infoNode.end])

	name := strings.TrimSpace(infoNode.stringValue("name"))
	if name == "" {
		name = "torrent"
	}

	private := false
	if pNode, ok := infoNode.dictValue("private"); ok && pNode.kind == nodeInt {
		private = pNode.intVal == 1
	}

	files, totalSize, err := parseTorrentFiles(infoNode, name)
	if err != nil {
		return MetaInfo{}, err
	}
	if totalSize <= 0 {
		return MetaInfo{}, errors.New("torrent 文件大小非法")
	}

	announceURLs := collectAnnounceURLs(root)
	announceHosts := extractAnnounceHosts(announceURLs)

	return MetaInfo{
		Name:          name,
		InfoHash:      strings.ToLower(hex.EncodeToString(infoHashBytes[:])),
		TotalSize:     totalSize,
		IsPrivate:     private,
		AnnounceURLs:  announceURLs,
		AnnounceHosts: announceHosts,
		Files:         files,
	}, nil
}

func ValidateAnnounceHosts(announceHosts []string, allowedDomains []string) error {
	allowed := make([]string, 0, len(allowedDomains))
	for _, domain := range allowedDomains {
		trimmed := normalizeDomain(domain)
		if trimmed == "" {
			continue
		}
		allowed = append(allowed, trimmed)
	}
	if len(allowed) == 0 {
		return nil
	}
	if len(announceHosts) == 0 {
		return errors.New("torrent 未包含可校验的 announce 域名")
	}
	for _, host := range announceHosts {
		matched := false
		for _, domain := range allowed {
			if host == domain || strings.HasSuffix(host, "."+domain) {
				matched = true
				break
			}
		}
		if !matched {
			return fmt.Errorf("announce 域名不在允许范围: %s", host)
		}
	}
	return nil
}

func normalizeDomain(raw string) string {
	v := strings.TrimSpace(strings.ToLower(raw))
	v = strings.TrimPrefix(v, "http://")
	v = strings.TrimPrefix(v, "https://")
	v = strings.TrimSuffix(v, "/")
	if idx := strings.Index(v, "/"); idx >= 0 {
		v = v[:idx]
	}
	return strings.TrimSuffix(v, ".")
}

func parseTorrentFiles(infoNode bNode, torrentName string) ([]FileEntry, int64, error) {
	if singleLengthNode, ok := infoNode.dictValue("length"); ok {
		if singleLengthNode.kind != nodeInt || singleLengthNode.intVal <= 0 {
			return nil, 0, errors.New("torrent length 字段非法")
		}
		fileName := strings.TrimSpace(torrentName)
		if fileName == "" {
			fileName = "file"
		}
		entry := FileEntry{
			Index: 0,
			Path:  fileName,
			Name:  path.Base(fileName),
			Size:  singleLengthNode.intVal,
		}
		return []FileEntry{entry}, singleLengthNode.intVal, nil
	}

	filesNode, ok := infoNode.dictValue("files")
	if !ok || filesNode.kind != nodeList || len(filesNode.list) == 0 {
		return nil, 0, errors.New("torrent 缺少 files 字段")
	}

	out := make([]FileEntry, 0, len(filesNode.list))
	var total int64
	for idx, fileNode := range filesNode.list {
		if fileNode.kind != nodeDict {
			return nil, 0, fmt.Errorf("torrent files[%d] 类型非法", idx)
		}
		lengthNode, ok := fileNode.dictValue("length")
		if !ok || lengthNode.kind != nodeInt || lengthNode.intVal <= 0 {
			return nil, 0, fmt.Errorf("torrent files[%d].length 非法", idx)
		}
		pathNode, ok := fileNode.dictValue("path")
		if !ok || pathNode.kind != nodeList || len(pathNode.list) == 0 {
			return nil, 0, fmt.Errorf("torrent files[%d].path 非法", idx)
		}

		parts := make([]string, 0, len(pathNode.list))
		for _, partNode := range pathNode.list {
			if partNode.kind != nodeString {
				return nil, 0, fmt.Errorf("torrent files[%d].path 包含非法片段", idx)
			}
			part := strings.TrimSpace(string(partNode.strVal))
			if part == "" {
				continue
			}
			parts = append(parts, part)
		}
		if len(parts) == 0 {
			return nil, 0, fmt.Errorf("torrent files[%d].path 为空", idx)
		}
		cleanPath := path.Clean(path.Join(parts...))
		if cleanPath == "." || strings.HasPrefix(cleanPath, "../") {
			return nil, 0, fmt.Errorf("torrent files[%d].path 非法", idx)
		}

		entry := FileEntry{
			Index: idx,
			Path:  cleanPath,
			Name:  path.Base(cleanPath),
			Size:  lengthNode.intVal,
		}
		out = append(out, entry)
		total += lengthNode.intVal
	}
	return out, total, nil
}

func collectAnnounceURLs(root bNode) []string {
	uniq := map[string]struct{}{}
	pushURL := func(raw string) {
		trimmed := strings.TrimSpace(raw)
		if trimmed == "" {
			return
		}
		uniq[trimmed] = struct{}{}
	}

	if announceNode, ok := root.dictValue("announce"); ok && announceNode.kind == nodeString {
		pushURL(string(announceNode.strVal))
	}
	if listNode, ok := root.dictValue("announce-list"); ok && listNode.kind == nodeList {
		for _, tierNode := range listNode.list {
			if tierNode.kind != nodeList {
				continue
			}
			for _, trackerNode := range tierNode.list {
				if trackerNode.kind != nodeString {
					continue
				}
				pushURL(string(trackerNode.strVal))
			}
		}
	}

	if len(uniq) == 0 {
		return nil
	}
	out := make([]string, 0, len(uniq))
	for item := range uniq {
		out = append(out, item)
	}
	sort.Strings(out)
	return out
}

func extractAnnounceHosts(announceURLs []string) []string {
	if len(announceURLs) == 0 {
		return nil
	}
	uniq := map[string]struct{}{}
	for _, rawURL := range announceURLs {
		parsed, err := url.Parse(strings.TrimSpace(rawURL))
		if err != nil {
			continue
		}
		host := strings.TrimSpace(strings.ToLower(parsed.Hostname()))
		if host == "" {
			continue
		}
		uniq[strings.TrimSuffix(host, ".")] = struct{}{}
	}
	if len(uniq) == 0 {
		return nil
	}
	out := make([]string, 0, len(uniq))
	for host := range uniq {
		out = append(out, host)
	}
	sort.Strings(out)
	return out
}

func parseNode(data []byte, idx int, depth int) (bNode, int, error) {
	if depth > maxBencodeDepth {
		return bNode{}, idx, errors.New("torrent bencode 嵌套层级过深")
	}
	if idx >= len(data) {
		return bNode{}, idx, errors.New("torrent bencode 非法：提前结束")
	}

	switch data[idx] {
	case 'i':
		return parseIntNode(data, idx)
	case 'l':
		return parseListNode(data, idx, depth)
	case 'd':
		return parseDictNode(data, idx, depth)
	default:
		if data[idx] >= '0' && data[idx] <= '9' {
			return parseStringNode(data, idx)
		}
		return bNode{}, idx, fmt.Errorf("torrent bencode 非法：未知类型 %q", data[idx])
	}
}

func parseIntNode(data []byte, idx int) (bNode, int, error) {
	start := idx
	idx++ // skip 'i'
	if idx >= len(data) {
		return bNode{}, idx, errors.New("torrent bencode 整数字段非法")
	}

	end := idx
	for end < len(data) && data[end] != 'e' {
		end++
	}
	if end >= len(data) {
		return bNode{}, idx, errors.New("torrent bencode 整数字段缺少结束符")
	}

	raw := string(data[idx:end])
	if raw == "" {
		return bNode{}, idx, errors.New("torrent bencode 整数字段为空")
	}
	if raw == "-0" {
		return bNode{}, idx, errors.New("torrent bencode 整数字段非法")
	}
	if strings.HasPrefix(raw, "0") && len(raw) > 1 {
		return bNode{}, idx, errors.New("torrent bencode 整数字段前导零非法")
	}
	if strings.HasPrefix(raw, "-0") && len(raw) > 2 {
		return bNode{}, idx, errors.New("torrent bencode 整数字段前导零非法")
	}
	val, err := strconv.ParseInt(raw, 10, 64)
	if err != nil {
		return bNode{}, idx, errors.New("torrent bencode 整数字段解析失败")
	}
	next := end + 1
	return bNode{
		kind:   nodeInt,
		start:  start,
		end:    next,
		intVal: val,
	}, next, nil
}

func parseStringNode(data []byte, idx int) (bNode, int, error) {
	start := idx
	colon := idx
	for colon < len(data) && data[colon] != ':' {
		if data[colon] < '0' || data[colon] > '9' {
			return bNode{}, idx, errors.New("torrent bencode 字符串长度字段非法")
		}
		colon++
	}
	if colon >= len(data) || data[colon] != ':' {
		return bNode{}, idx, errors.New("torrent bencode 字符串缺少分隔符")
	}
	rawLen := string(data[idx:colon])
	if rawLen == "" {
		return bNode{}, idx, errors.New("torrent bencode 字符串长度为空")
	}
	if strings.HasPrefix(rawLen, "0") && len(rawLen) > 1 {
		return bNode{}, idx, errors.New("torrent bencode 字符串长度前导零非法")
	}
	length, err := strconv.Atoi(rawLen)
	if err != nil || length < 0 {
		return bNode{}, idx, errors.New("torrent bencode 字符串长度非法")
	}
	valueStart := colon + 1
	valueEnd := valueStart + length
	if valueEnd > len(data) {
		return bNode{}, idx, errors.New("torrent bencode 字符串越界")
	}
	return bNode{
		kind:   nodeString,
		start:  start,
		end:    valueEnd,
		strVal: data[valueStart:valueEnd],
	}, valueEnd, nil
}

func parseListNode(data []byte, idx int, depth int) (bNode, int, error) {
	start := idx
	idx++ // skip 'l'
	list := make([]bNode, 0)
	for {
		if idx >= len(data) {
			return bNode{}, idx, errors.New("torrent bencode 列表缺少结束符")
		}
		if data[idx] == 'e' {
			next := idx + 1
			return bNode{
				kind:  nodeList,
				start: start,
				end:   next,
				list:  list,
			}, next, nil
		}
		node, next, err := parseNode(data, idx, depth+1)
		if err != nil {
			return bNode{}, idx, err
		}
		list = append(list, node)
		idx = next
	}
}

func parseDictNode(data []byte, idx int, depth int) (bNode, int, error) {
	start := idx
	idx++ // skip 'd'
	dict := make([]bPair, 0)
	for {
		if idx >= len(data) {
			return bNode{}, idx, errors.New("torrent bencode 字典缺少结束符")
		}
		if data[idx] == 'e' {
			next := idx + 1
			return bNode{
				kind:  nodeDict,
				start: start,
				end:   next,
				dict:  dict,
			}, next, nil
		}
		keyNode, next, err := parseStringNode(data, idx)
		if err != nil {
			return bNode{}, idx, errors.New("torrent bencode 字典键非法")
		}
		valNode, valNext, err := parseNode(data, next, depth+1)
		if err != nil {
			return bNode{}, idx, err
		}
		dict = append(dict, bPair{key: string(keyNode.strVal), val: valNode})
		idx = valNext
	}
}

func (n bNode) dictValue(key string) (bNode, bool) {
	if n.kind != nodeDict {
		return bNode{}, false
	}
	for _, kv := range n.dict {
		if kv.key == key {
			return kv.val, true
		}
	}
	return bNode{}, false
}

func (n bNode) stringValue(key string) string {
	v, ok := n.dictValue(key)
	if !ok || v.kind != nodeString {
		return ""
	}
	return string(v.strVal)
}
