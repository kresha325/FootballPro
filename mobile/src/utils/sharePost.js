import { Alert, Linking, Share } from 'react-native';
import { WEB_APP_URL } from '../config/constants';

export function getPostShareUrl(postId) {
  const base = (WEB_APP_URL || 'https://xtalenti.com').replace(/\/$/, '');
  return `${base}/post/${postId}`;
}

export function getPostShareText(post) {
  const content = String(post?.content || '').trim();
  const author = post?.author;
  const name = author ? `${author.firstName || ''} ${author.lastName || ''}`.trim() : '';
  if (content) {
    return content.length > 220 ? `${content.slice(0, 217)}…` : content;
  }
  if (name) return `Post nga ${name} në FootballPro`;
  return 'Shiko këtë post në FootballPro';
}

async function openShareUrl(url, failLabel) {
  try {
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      Alert.alert('Nuk u hap', `${failLabel} nuk është i disponueshëm në këtë pajisje.`);
      return;
    }
    await Linking.openURL(url);
  } catch {
    Alert.alert('Gabim', `Nuk u hap ${failLabel}.`);
  }
}

export async function sharePostNative(post) {
  const url = getPostShareUrl(post.id);
  const text = getPostShareText(post);
  await Share.share({
    message: `${text}\n${url}`,
    url,
    title: 'FootballPro',
  });
}

export async function sharePostWhatsApp(post) {
  const url = getPostShareUrl(post.id);
  const text = getPostShareText(post);
  const full = `${text} ${url}`.trim();
  await openShareUrl(`https://wa.me/?text=${encodeURIComponent(full)}`, 'WhatsApp');
}

export async function sharePostFacebook(post) {
  const url = getPostShareUrl(post.id);
  await openShareUrl(
    `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    'Facebook'
  );
}

export async function sharePostTwitter(post) {
  const url = getPostShareUrl(post.id);
  const text = getPostShareText(post);
  await openShareUrl(
    `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
    'X (Twitter)'
  );
}
