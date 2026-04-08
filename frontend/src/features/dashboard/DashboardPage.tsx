import {
  Box,
  Grid,
  GridItem,
  HStack,
  Stat,
  StatLabel,
  StatNumber,
  Text,
  VStack,
  useToast,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertList } from "../../components/ui/AlertList";
import { ActivityList } from "../../components/ui/ActivityList";
import { ExportMenu } from "../../components/operations/ExportMenu";
import { Button } from "../../components/ui/Button";
import { MetricCard } from "../../components/ui/MetricCard";
import { PageHeader } from "../../components/ui/PageHeader";
import { Section } from "../../components/ui/Section";
import { Surface } from "../../components/ui/Surface";
import { downloadCsv, downloadJson } from "../../lib/export";
import { getNotificationCenterData } from "../notifications/api";
import { getLogStats } from "../reporting/api";
import {
  dashboardStats,
  quickActions,
  recentAlerts,
  recentActivity,
} from "./mockData";

export const DashboardPage = () => {
  const toast = useToast();
  const navigate = useNavigate();
  const [liveAlertCount, setLiveAlertCount] = useState<number>(0);

  useEffect(() => {
    const loadCounts = async () => {
      try {
        const response = await getNotificationCenterData();
        setLiveAlertCount(response.counts.total);
      } catch {
        setLiveAlertCount(0);
      }
    };

    void loadCounts();
  }, []);

  const metricIconMap = {
    shield: <Text fontSize="xl">S</Text>,
    clock: <Text fontSize="xl">T</Text>,
    branch: <Text fontSize="xl">A</Text>,
    link: <Text fontSize="xl">L</Text>,
  };

  const exportSnapshotJson = async () => {
    try {
      const [alerts, stats] = await Promise.all([
        getNotificationCenterData(),
        getLogStats(),
      ]);

      const payload = {
        generated_at: new Date().toISOString(),
        log_stats: stats,
        notification_counts: alerts.counts,
        top_alerts: alerts.alerts.slice(0, 10),
        metrics: dashboardStats,
      };
      downloadJson("agentflow-dashboard-snapshot.json", payload);
    } catch {
      toast({
        title: "Export failed",
        description: "Unable to build dashboard snapshot right now.",
        status: "error",
        duration: 3000,
      });
    }
  };

  const exportSnapshotCsv = async () => {
    try {
      const alerts = await getNotificationCenterData();
      downloadCsv(
        "agentflow-dashboard-alerts.csv",
        alerts.alerts.slice(0, 100).map((alert) => ({
          id: alert.id,
          source: alert.source,
          severity: alert.severity,
          title: alert.title,
          description: alert.description,
          timestamp: alert.timestamp,
          session_id: alert.sessionId,
          agent_id: alert.agentId,
          route: alert.route,
        }))
      );
    } catch {
      toast({
        title: "Export failed",
        description: "Unable to export snapshot CSV right now.",
        status: "error",
        duration: 3000,
      });
    }
  };

  return (
    <VStack align="stretch" spacing={8}>
      <PageHeader
        title="Dashboard"
        description="Track platform activity, monitor risk signals, and move quickly from overview to action."
        actions={
          <HStack>
            <ExportMenu
              label="Export snapshot"
              onExportJson={() => void exportSnapshotJson()}
              onExportCsv={() => void exportSnapshotCsv()}
            />
            <Button onClick={() => navigate("/builder")}>Open builder</Button>
          </HStack>
        }
      />

      <Surface
        bg="linear-gradient(135deg, rgba(255, 242, 198, 0.75) 0%, rgba(170, 196, 245, 0.15) 100%)"
      >
        <Grid templateColumns={{ base: "1fr", lg: "1.4fr 1fr" }} gap={5} alignItems="center">
          <GridItem>
            <VStack align="start" spacing={2}>
              <Text
                color="text.muted"
                fontSize="xs"
                textTransform="uppercase"
                letterSpacing="0.08em"
              >
                Monitoring and governance
              </Text>
              <Text fontSize={{ base: "2xl", md: "3xl" }} fontWeight="700" letterSpacing="-0.02em">
                Welcome back. Your agent operations look steady today.
              </Text>
              <Text color="text.secondary" maxW="680px">
                Focus on pending approvals and investigation escalations first, then continue builder rollout for the new incident workflow.
              </Text>
            </VStack>
          </GridItem>
          <GridItem>
            <Box
              bg="bg.surface"
              border="1px solid"
              borderColor="border.soft"
              borderRadius="lg"
              p={4}
            >
              <VStack align="stretch" spacing={2}>
                <Text fontSize="sm" color="text.secondary" fontWeight="600">
                  Today at a glance
                </Text>
                <Stat>
                  <StatLabel color="text.muted">Live alerts</StatLabel>
                  <HStack justify="space-between" align="center">
                    <StatNumber>{liveAlertCount}</StatNumber>
                    <Button size="sm" variant="ghost" onClick={() => navigate("/notifications")}>
                      Open alerts
                    </Button>
                  </HStack>
                </Stat>
                <HStack justify="space-between">
                  <Text color="text.muted" fontSize="sm">
                    Active policies
                  </Text>
                  <Text fontWeight="700">12</Text>
                </HStack>
                <HStack justify="space-between">
                  <Text color="text.muted" fontSize="sm">
                    Human approvals
                  </Text>
                  <Text fontWeight="700">7 pending</Text>
                </HStack>
                <HStack justify="space-between">
                  <Text color="text.muted" fontSize="sm">
                    Tool health
                  </Text>
                  <Text fontWeight="700">97.8%</Text>
                </HStack>
              </VStack>
            </Box>
          </GridItem>
        </Grid>
      </Surface>

      <Grid templateColumns={{ base: "1fr", xl: "repeat(4, 1fr)" }} gap={4}>
        {dashboardStats.map((item) => (
          <GridItem key={item.label}>
            <MetricCard
              label={item.label}
              value={item.value}
              meta={item.meta}
              status={item.status}
              statusLabel={item.statusLabel}
              icon={metricIconMap[item.icon]}
            />
          </GridItem>
        ))}
      </Grid>

      <Grid templateColumns={{ base: "1fr", xl: "1.3fr 1fr" }} gap={5}>
        <GridItem>
          <Section title="Recent alerts">
            <AlertList items={recentAlerts} />
          </Section>
        </GridItem>

        <GridItem>
          <Section title="Quick actions">
            <VStack align="stretch" spacing={3}>
              {quickActions.map((action) => (
                <Surface
                  key={action.id}
                  as="button"
                  textAlign="left"
                  p={4}
                  _hover={{ borderColor: "brand.300", transform: "translateY(-1px)" }}
                  onClick={() => navigate(action.route)}
                >
                  <VStack align="start" spacing={1}>
                    <HStack>
                      <Box w="8px" h="8px" borderRadius="full" bg="brand.500" />
                      <Text fontWeight="600">{action.label}</Text>
                    </HStack>
                    <Text color="text.secondary" fontSize="sm">
                      {action.description}
                    </Text>
                  </VStack>
                </Surface>
              ))}
            </VStack>
          </Section>
        </GridItem>
      </Grid>

      <Section title="Recent activity">
        <ActivityList items={recentActivity} />
      </Section>
    </VStack>
  );
};
