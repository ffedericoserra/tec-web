const CONTENT_PLACEHOLDER = '/uploads/contents/placeholder.jpg';

export function contentImagePath(content) {
  return content?.imgPath || content?.imageUrl || CONTENT_PLACEHOLDER;
}
