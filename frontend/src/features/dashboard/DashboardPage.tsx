import {
  Box,
  Grid,
  GridItem,
  HStack,
  Text,
  VStack,
} from "@chakra-ui/react";
import { useNavigate } from "react-router-dom";
import { AlertList } from "../../components/ui/AlertList";
import { ActivityList } from "../../components/ui/ActivityList";
import { Button } from "../../components/ui/Button";
import { MetricCard } from "../../components/ui/MetricCard";
import { PageHeader } from "../../components/ui/PageHeader";
import { Section } from "../../components/ui/Section";
import { Surface } from "../../components/ui/Surface";
import {
  dashboardStats,
  quickActions,
  recentAlerts,
  recentActivity,
} from "./mockData";

export const DashboardPage = () => {
  const navigate = useNavigate();
  const metricIconMap = {
    shield: <Text fontSize="xl">S</Text>,
    clock: <Text fontSize="xl">T</Text>,
    branch: <Text fontSize="xl">A</Text>,
    link: <Text fontSize="xl">L</Text>,
  };

  return (
    <VStack align="stretch" spacing={8}>
      <PageHeader
        title="Dashboard"
        description="Track platform activity, monitor risk signals, and move quickly from overview to action."
        actions={
          <HStack>
            <Button variant="outline">Export snapshot</Button>
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
