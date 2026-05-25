import { StyleSheet } from 'react-native';

import { colors } from '../../../constants/colors';
import { typography } from '../../../constants/typography';

export const authSignInStyles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.auth.shellBackground,
  },
  pageGradient: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: colors.layout.space4,
    paddingVertical: colors.layout.space6,
  },
  card: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    backgroundColor: colors.auth.shellCardBackground,
    borderRadius: colors.layout.radiusXl,
    borderWidth: 1,
    borderColor: colors.auth.shellCardBorder,
    padding: colors.layout.space5,
    ...colors.shadow.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: colors.layout.space5,
  },
  title: {
    ...typography.pageTitle,
    color: colors.text.primary,
    textAlign: 'center',
    marginTop: colors.layout.space3,
    marginBottom: colors.layout.space1,
  },
  subtitle: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: colors.layout.space2,
  },
  helper: {
    ...typography.caption,
    color: colors.text.tertiary,
    textAlign: 'center',
    maxWidth: 320,
    alignSelf: 'center',
  },
  methodsSection: {
    marginTop: colors.layout.space2,
  },
  methodsCaptionWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: colors.layout.space4,
  },
  methodsCaptionLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.auth.methodsDivider,
  },
  methodsCaptionText: {
    ...typography.label,
    color: colors.text.secondary,
    textTransform: 'uppercase',
    marginHorizontal: colors.layout.space3,
  },
  methodsButtons: {
    gap: colors.layout.space3,
  },

  googleButton: {
    marginBottom: 0,
  },

  telegramButton: {
    marginBottom: 0,
  },

  telegramStateCard: {
    marginTop: colors.layout.space1,
    marginBottom: colors.layout.space1,
    padding: colors.layout.space3,
    borderRadius: colors.layout.radiusLg,
    borderWidth: 1,
    borderColor: colors.auth.telegramStateCardBorder,
    backgroundColor: colors.auth.telegramStateCardBackground,
    gap: colors.layout.space2,
  },
  telegramStatusText: {
    color: colors.text.secondary,
    fontSize: 14,
    lineHeight: 20,
  },
  telegramFlowActions: {
    gap: colors.layout.space2,
  },
  telegramActionButton: {
    marginBottom: 0,
  },

  whatsAppButton: {
    marginBottom: 0,
  },
});
